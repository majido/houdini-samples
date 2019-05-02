// A simple library that uses Shared-Array-Buffer to forward events to worklet/worker.
'use strict';

const MAX_MESSAGE_SIZE = 1024;

// returns handle that can be posted to worker/worklet
function sender() {
  let buffer = new SharedArrayBuffer((MAX_MESSAGE_SIZE + 1) * 2);
  let main_view = new Uint16Array(buffer);

  function send(object) {
    const str = JSON.stringify(object);
    // console.log(`sending ==> ${str}`)

    const bytes = str2array(str);
    copyMessage(bytes, main_view);
  }

  function sendEvent(event) {
    // console.log(event);
    const sanitizedEvent = {
      type: event.type,
      timeStamp: event.timeStamp,
      screenX: event.screenX,
      screenY: event.screenY,
    };

    send(sanitizedEvent);
  }

  function delegate(targetEl, eventTypes) {
    for (let eventType of eventTypes) {
      targetEl.addEventListener(
        eventType,
        sendEvent,
        {passive: true}
      );
    }

    function undelegate() {
      for (let eventType of eventTypes) {
        targetEl.removeEventListener(sendEvent);
      }
    }

    return undelegate;
  }

  return {
    pipe: { buffer_ : buffer }, // TODO: use a private symbol
    send: send,
    delegate: delegate
  }
}

// Use inside worker/workler and pass in the handler to SAB
function receiver(pipe) {
  const worklet_view = new Uint16Array(pipe.buffer_);

  function receive() {
    // TODO(majidvp): use atomics!
    const worklet_view = new Uint16Array(pipe.buffer_);

    // first uint16 is length
    const message_length = worklet_view[0];
    const message_view = new Uint16Array(pipe.buffer_, 2, message_length);

    return array2str(message_view);
  }

  return receive;
}

// Utilities

// copied from: https://developers.google.com/web/updates/2012/06/How-to-convert-ArrayBuffer-to-and-from-String
function array2str(array/* expects Uint16 */) {
  return String.fromCharCode.apply(null, array);
}
function str2array(str) {
  var buf = new ArrayBuffer(str.length * 2); // 2 bytes for each char
  var bufView = new Uint16Array(buf);
  for (var i=0, strLen=str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i);
  }
  return bufView;
}

function copyMessage(source, destination) {
  if (source.length > MAX_MESSAGE_SIZE)
    throw `Message is larger (${source.length}) than the max size`;

  if (destination.length - 1 < source.length)
    throw `The destination buffer is not large enough for ${source.length} bytes`;

  destination[0] = source.length;
  for (let i = 0; i < source.length; i++)
    destination[i+1] = source[i];
}



export {sender, receiver}