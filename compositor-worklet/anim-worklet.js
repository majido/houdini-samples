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
(function(scope) {
  "use strict";

  // TODO(flackr): Detect if we have native support for animationWorklet.

  var animatedElements = {};
  var onElementsUpdated = function() {};

  var CompositorWorkerAnimationWorklet = function() {
    var awaitingPromises = [];

    // Find the path of cw-polyfill.js.
    var scriptEls = document.getElementsByTagName( 'script' );
    var thisScriptEl = scriptEls[scriptEls.length - 1];
    var scriptPath = thisScriptEl.src;
    var scriptFolder = scriptPath.substr(0, scriptPath.lastIndexOf( '/' ) + 1);

    var animators = {};

    var cw = new CompositorWorker(scriptFolder + 'anim-worklet-worker.js');
    cw.onmessage = function(event) {
      var data = event.data;
      if (data.resolve) {
        if (data.resolve.success)
          awaitingPromises[data.resolve.id].resolve(data.resolve.arguments);
        else
          awaitingPromises[data.resolve.id].reject(data.resolve.arguments);
        delete awaitingPromises[data.resolve.id];
      }
      if (data.type == 'log') {
        console.log(data.message);
      } else if (data.type == 'animator') {
        animators[data.name] = data.details;
        updateCWElements();
      }
    };

    onElementsUpdated = updateCWElements;

    function getProperties(elem, properties) {
      var result = {}
      var cs = getComputedStyle(elem);
      for (var i = 0; i < properties.length; i++) {
        result[properties[i]] = cs.getPropertyValue(properties[i]).trim();
      }
      return result;
    }

    var acceleratedStyles = {
      'opacity': true,
      'transform': true};
    function filterCompositedProperties(inputPropertyList, outputPropertyList) {
      var accelerated = [];
      for (var i = 0; i < inputPropertyList.length; i++) {
        if (acceleratedStyles[inputPropertyList[i]])
          accelerated.push(inputPropertyList[i]);
      }
      for (var i = 0; i < outputPropertyList.length; i++) {
        if (acceleratedStyles[outputPropertyList[i]])
          accelerated.push(outputPropertyList[i]);
      }
      return accelerated;
    }

    function updateCWElements() {
      var elementUpdate = {};
      for (var animator in animators) {
        var details = animators[animator];
        var roots = animatedElements[animator];
        if (!roots)
          continue;
        elementUpdate[animator] = [];
        for (var i = 0; i < roots.length; i++) {
          var rootProperties = [];
          if (details.rootInputScroll) {
            rootProperties.push('scrollTop');
            rootProperties.push('scrollLeft');
          }
          elementUpdate[animator].push({
            'root': {
              'proxy': rootProperties.length ? new CompositorProxy(roots[i].root, rootProperties) : null,
              'styleMap': getProperties(roots[i].root, details.inputProperties)},
            'children': [],
          });
          for (var j = 0; j < roots[i].children.length; j++) {
            var properties = filterCompositedProperties(details.inputProperties, details.outputProperties);
            elementUpdate[animator][i].children.push({
              'proxy': properties.length ? new CompositorProxy(roots[i].children[j], properties) : null,
              'styleMap': getProperties(roots[i].children[j], details.inputProperties),
            });
          }
        }
      }
      cw.postMessage({'type': 'updateElements', 'elements': elementUpdate});
    };

    function importOnCW(src) {
      return get(src).then(function(response) {
        return new Promise(function(resolve, reject) {
          var nextId = awaitingPromises.length;
          awaitingPromises[nextId] = {'resolve': resolve, 'reject': reject};
          cw.postMessage({'type': 'import', 'src': src, 'content': response, 'id': nextId});
        });
      });
    }

    return {
      'import': importOnCW,
    };
  };

  function updateElements() {
    animatedElements = {};
    var elements = document.getElementsByTagName("*");
    for (var i = 0; i < elements.length; ++i) {
      var elem = elements[i];
      var animator = getComputedStyle(elem).getPropertyValue('--animator');
      // TODO(flackr): This is a hack for not getting inherited animator properties.
      var parentAnimator = elem.parentElement && getComputedStyle(elem.parentElement).getPropertyValue('--animator');
      if (animator && animator != parentAnimator) {
        animator = animator.trim();
        animatedElements[animator] = animatedElements[animator] || [{'root': undefined, 'children': []}];
        animatedElements[animator][0].children.push(elem);
      }

      var animatorRoot = getComputedStyle(elem).getPropertyValue('--animator-root');
      // TODO(flackr): This is a hack for not getting inherited animator properties.
      var parentAnimatorRoot = elem.parentElement && getComputedStyle(elem.parentElement).getPropertyValue('--animator-root');
      if (animatorRoot && animatorRoot != parentAnimatorRoot) {
        animatorRoot = animatorRoot.trim();
        animatedElements[animatorRoot] = animatedElements[animatorRoot] || [{'root': undefined, 'children': []}];
        // TODO(flackr): Support multiple roots.
        animatedElements[animatorRoot][0].root = elem;
      }
    };
    onElementsUpdated();
  }
  document.addEventListener('DOMContentLoaded', updateElements);

  var MainThreadAnimationWorklet = function() {
    function importOnMain(src) {
      console.warn('Main thread polyfill is not complete yet.');
      return new Promise(function(resolve, reject) {
        var script = document.createElement('script');
        script.src = src;
        script.onload = function() {
          resolve();
        }
        script.onerror = function() {
          reject(Error('Failed to load ' + src));
        }
        document.body.appendChild(script);
      });
    }

    var ctors = {};
    // This is invoked in the worklet to register |name|.
    scope.registerAnimator = function(name, ctor) {
      ctors[name] = ctor;
    };

    var animators = {};

    // Polyfill of DOMMatrix if unavailable.
    if (!scope.DOMMatrix) {
      // Note: Only 'matrix(...)' and 'matrix3d(...)' are supported.
      scope.DOMMatrix = function(transformDesc) {
        this.m11 = 1;
        this.m21 = 0;
        this.m31 = 0;
        this.m41 = 0;

        this.m12 = 0;
        this.m22 = 1;
        this.m32 = 0;
        this.m42 = 0;

        this.m13 = 0;
        this.m23 = 0;
        this.m33 = 1;
        this.m43 = 0;

        this.m14 = 0;
        this.m24 = 0;
        this.m34 = 0;
        this.m44 = 1;

        if (transformDesc && typeof(transformDesc) == 'string') {
          if (transformDesc.startsWith('matrix(')) {
            var values = transformDesc.substring(7, transformDesc.length - 1).split(', ').map(parseFloat);
            if (values.length != 6)
              throw new Error('Unable to parse transform string: ' + transformDesc);
            this.m11 = values[0];
            this.m12 = values[1];
            this.m21 = values[2];
            this.m22 = values[3];
            this.m41 = values[4];
            this.m42 = values[5];
          } else if (transformDesc.startsWith('matrix3d(')) {
            var values = transformDesc.substring(9, transformDesc.length - 1).split(', ').map(parseFloat);
            if (values.length != 16)
              throw new Error('Unable to parse transform string: ' + transformDesc);
            this.m11 = values[0];
            this.m12 = values[1];
            this.m13 = values[2];
            this.m14 = values[3];

            this.m21 = values[4];
            this.m22 = values[5];
            this.m23 = values[6];
            this.m24 = values[7];

            this.m31 = values[8];
            this.m32 = values[9];
            this.m33 = values[10];
            this.m34 = values[11];

            this.m41 = values[12];
            this.m42 = values[13];
            this.m43 = values[14];
            this.m44 = values[15];
          } else {
            throw new Error('Unable to parse transform string: ' + transformDesc);
          }
        }
      };

      scope.DOMMatrix.prototype = {
        toString: function(element) {
          return 'matrix3d(' +
              this.m11 + ', ' + this.m12 + ', ' + this.m13 + ', ' + this.m14 + ', ' +
              this.m21 + ', ' + this.m22 + ', ' + this.m23 + ', ' + this.m24 + ', ' +
              this.m31 + ', ' + this.m32 + ', ' + this.m33 + ', ' + this.m34 + ', ' +
              this.m41 + ', ' + this.m42 + ', ' + this.m43 + ', ' + this.m44 + ')';
        },
      };
    }

    return {
      'import': importOnMain,
    }
  };

  // Minimal Promise implementation for browsers which do not have promises.
  scope.Promise = scope.Promise || function(exec) {
    var then = undefined;
    var resolve = function() {
      if (!then)
        throw new Error('No function specified to call on success.');
      then.apply(null, arguments);
    }.bind(this);
    var reject = function(e) { throw e; };
    this.then = function(fn) { then = fn; };
    exec(resolve, reject);
  };

  scope.String.prototype.startsWith = scope.String.prototype.startsWith || function(s) {
    return this.substring(0, s.length) == s;
  };

  function get(url) {
    return new Promise(function(resolve, reject) {
      var req = new XMLHttpRequest();
      // TODO(flackr): Figure out why we keep getting stale response when using 'GET'.
      req.open('POST', url);

      req.onload = function() {
        if (req.status == 200)
          resolve(req.response);
        else
          reject(Error(req.statusText));
      };

      req.onerror = function() {
        reject(Error("Network error"));
      };

      req.send();
    });
  }

  // TODO(flackr): It seems we can't properly polyfill animationWorklet because it exists with --experimental-web-platform-features and seems to be read-only.
  scope.polyfillAnimationWorklet = scope.CompositorWorker ? CompositorWorkerAnimationWorklet() : MainThreadAnimationWorklet();
  scope.polyfillAnimationWorklet.updateElements = updateElements;

})(self);