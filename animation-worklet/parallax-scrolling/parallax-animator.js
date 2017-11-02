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
registerAnimator('parallax', class ParallaxAnimator {
  animate(currentTime, effect) {
    let parallaxRate = 0.4;
    // TODO(majidvp): At the moment currentTime is in milliseconds and localTime
    // is in second :(. So we convert them here but this is fixed once this CL
    // lands: https://chromium-review.googlesource.com/c/chromium/src/+/734231
    effect.localTime = parallaxRate *  0.001 * currentTime;
  }
});