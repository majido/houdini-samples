/*
Copyright 2016 Google, Inc. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
function sign(value) {
  return value < 0 ? -1 : 1;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

var BAR_HEIGHT = 190
var MIN_HIDE_AMOUNT = -1 * BAR_HEIGHT; // fully hidden
var MAX_HIDE_AMOUNT = 0;               // fully shown
var HIDE_SPEED = 0.35;
var TIME_DELTA = 16;

// number of frames to wait before considering scroll to be inactive.
// This is a short-term hack until we have proper ScrollTimline.phase.
var FRAMES_TO_WAIT = 8;

registerAnimator('twitter-header', class TwitterHeader {
  constructor() {
    this.hideAmount_ = 0;
    this.lastDirection_ = 1;
    this.lastScrollPos_ = -1;
    this.countIdleFrames = 0;
  }

  animate(currentTime, effect) {
    var scrollPos = currentTime;

    // Drive animation based on scroll delta.
    var lastScroll = (this.lastScrollPos_ - scrollPos);
    this.lastScrollPos_ = scrollPos;

    // Wait for N frames of no scroll before assuming idle.
    if (lastScroll == 0) {
      this.countIdleFrames++;
    } else {
      this.countIdleFrames = 0;
      this.lastDirection_ = sign(lastScroll);
    }

    var scrollPhase;
    if (this.countIdleFrames == 0)
      scrollPhase = 'active';
    else if (this.countIdleFrames < FRAMES_TO_WAIT)
      scrollPhase = 'waiting';
    else
      scrollPhase = 'idle';


    switch(scrollPhase){
      case 'idle':
        // drive animation based on time delta
        // TODO: We should probably animate to hide/show based on how much the
        // bar is visibile instead of the direction of the movement.
        this.hideAmount_ += this.lastDirection_ * HIDE_SPEED  * TIME_DELTA;
        break;
      case 'active':
         // drive animation based on scroll delta
        this.hideAmount_ += lastScroll;
        break;
    }

    var baseline = clamp(-scrollPos, MIN_HIDE_AMOUNT, MAX_HIDE_AMOUNT);
    this.hideAmount_ = clamp(this.hideAmount_, baseline, MAX_HIDE_AMOUNT);

     // Position header bar according to scroll position and hide amount.
    effect.localTime = 0.001 *  (scrollPos + this.hideAmount_);

  }
});