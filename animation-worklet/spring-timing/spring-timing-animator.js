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
registerAnimator('spring', class SpringAnimator {
  static get inputProperties() { return ['--spring-k', '--ratio', '--distance']; }
  static get outputProperties() { return ['transform']; }
  static get inputTime() { return true; }

  animate(root, children, timeline, console) {
    children.forEach((e) => {
      if (!e.springTiming_)  {
        // initialize the simulation.
        const k = parseFloat(e.styleMap.get('--spring-k'));
        const distance = parseFloat(e.styleMap.get('--distance'));
        const ratio = Math.min(parseFloat(e.styleMap.get('--ratio')), 1);

        e.startTime_ = timeline.currentTime;
        e.springTiming_ = this.springTiming(k, ratio , distance);
      }

      // compute the new value based on spring simulation.
      // TODO(majidvp): stop ticking the animation once a threshold is reached.
      var dt_seconds = (timeline.currentTime - e.startTime_) / 1000;
      var dv = e.springTiming_(dt_seconds);


      // update the transform.
      var t = e.styleMap.transform;
      t.m41 = dv;
      e.styleMap.transform = t;
    });

  }

  // Based on flutter spring simulation for under-damped springs.
  // assumes mass = 1
  // assumes velocity = 100;
  // https://github.com/flutter/flutter/blob/cbe650a7e67931c0208a796fc17550e5c436d340/packages/flutter/lib/src/physics/spring_simulation.dart
  springTiming(springConstant, ratio, distance) {
    console.log([springConstant, ratio, distance].join(','));
    const damping = ratio * 2.0 * Math.sqrt(springConstant);
    const w = Math.sqrt(4.0 * springConstant - damping * damping) / 2.0;
    const r = -(damping / 2.0);
    const c1 = distance;
    const c2 = (100 - r * distance) / w;


    return function(time) {
      const result =  Math.pow(Math.E, r * time) *
           (c1 * Math.cos(w * time) + c2 * Math.sin(w * time));
      return distance - result;
    }
  }

});