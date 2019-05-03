// A simple library that uses Shared-Array-Buffer to forward events to worklet/worker.
"use strict";

import { Lock } from "./lock.js";

const MAX_MESSAGE_SIZE = 1024;

// returns handle that can be posted to worker/worklet
function sender() {
  // first 4 bytes are used for lock
  // next two bytes are used for the  message length
  // remaining MAX_MESSAGE_SIZE * 2 bytes are used for message content
  const buffer = new SharedArrayBuffer(MAX_MESSAGE_SIZE * 2 + 6);
  const lock_view = new Int32Array(buffer, 0, 4);
  const main_view = new Uint16Array(buffer, 4);

  let pending_message_;

  Lock.initialize(lock_view, 0);
  const lock_ = new Lock(lock_view, 0);

  function trySend() {
    if (!pending_message_) return;
    // We cannot wait() on main thread instead tryLock
    if (!lock_.tryLock()) {
      console.log("pending send");
      window.requestAnimationFrame(trySend.bind(this));
      return;
    }

    // receiver has not read last message, so we wait
    if (main_view[0] != 0) {
      lock_.unlock();
      window.requestAnimationFrame(trySend.bind(this));
      return;
    }

    copyMessage(pending_message_, main_view);
    //console.log("send");
    lock_.unlock();
    pending_message_ = null;
  }

  function send(object) {
    const str = JSON.stringify(object);
    const bytes = str2array(str);
    pending_message_ = bytes;
    trySend();
  }

  function sendEvent(event) {
    // console.log(event);
    const sanitizedEvent = {
      type: event.type,
      timeStamp: event.timeStamp,
      screenX: event.screenX,
      screenY: event.screenY
    };

    send(sanitizedEvent);
  }

  function delegate(targetEl, eventTypes) {
    for (let eventType of eventTypes) {
      targetEl.addEventListener(eventType, sendEvent, { passive: true });
    }

    function undelegate() {
      for (let eventType of eventTypes) {
        targetEl.removeEventListener(sendEvent);
      }
    }

    return undelegate;
  }

  return {
    pipe: { buffer_: buffer }, // TODO: use a private symbol
    send: send,
    delegate: delegate
  };
}

// Use inside worker/workler and pass in the handler to SAB
function receiver(pipe) {
  const lock_view = new Int32Array(pipe.buffer_, 0, 4);
  const worklet_view = new Uint16Array(pipe.buffer_, 4);

  const lock_ = new Lock(lock_view, 0);

  function receive() {
    // Atomic.wait() and lock() are not currently allowed on
    // worklets so use a tryLock with busy loop.
    // lock_.lock();
    while (!lock_.tryLock()) {}
    // first uint16 is length
    const message_length = worklet_view[0];
    const message_view = new Uint16Array(pipe.buffer_, 6, message_length);
    const result = array2str(message_view);
    // write 0 on first byte to indicate read is complete
    worklet_view[0] = 0;
    lock_.unlock();
    return result;
  }

  return receive;
}

// Utilities

// copied from: https://developers.google.com/web/updates/2012/06/How-to-convert-ArrayBuffer-to-and-from-String
function array2str(array /* expects Uint16 */) {
  return String.fromCharCode.apply(null, array);
}
function str2array(str) {
  var buf = new ArrayBuffer(str.length * 2); // 2 bytes for each char
  var bufView = new Uint16Array(buf);
  for (var i = 0, strLen = str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i);
  }
  return bufView;
}

function copyMessage(source, destination) {
  if (source.length > MAX_MESSAGE_SIZE)
    throw `Message is larger (${source.length}) than the max size`;

  if (destination.length - 1 < source.length)
    throw `The destination buffer is not large enough for ${
      source.length
    } bytes`;

  destination[0] = source.length;
  for (let i = 0; i < source.length; i++) {
    destination[i + 1] = source[i];
  }
}

export { sender, receiver };
