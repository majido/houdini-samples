import { receiver } from "./event-delegation.js";

registerAnimator(
  "dnd",
  class {
    constructor(options, state) {
      // console.log('construct animation worklet');
      this.receive = receiver(options.pipe);
      this.releaseBehavior = options.releaseBehavior;
      this.maxPosition = options.maxPosition;
      this.targetWidth = options.targetWidth;

      this.state_ = state || {
        // we have three phase: idle, finishing, tracking
        phase: "idle",
        current: {
          localTime: 0
        },
        target: {
          localTime: -1
        },
        last: {
          message: "",
          currentTime: 0,
          position: null,
          movement: null,
          intertialDelta: 0
        }
      };
    }

    animate(currentTime, effect) {
      // We only animate based on time when in the finishing phase.
      const timeChanged =
        "finishing" == this.state_.phase &&
        currentTime != this.state_.last.currentTime;

      let message = this.receive();
      const inputChanged =
        "finishing" != this.state_.phase &&
        (message.length != 0 && message != this.state_.last.message);
      if (!timeChanged && !inputChanged) {
        return;
      }

      this.state_.last.message = message;
      this.state_.last.currenTime = currentTime;

      const { events, movement } = this.processEvents(message);

      // Update the phase based on event
      const phase = this.calculatePhase(events);

      // Animate based on the phase and pointer movement
      let time;
      switch (phase) {
        case "tracking":
          time = this.state_.current.localTime + movement.deltaX;
          break;
        case "finishing":
          time = this.moveTowardFinalTargetWithVelocity();
          break;
        case "idle":
          time = this.state_.current.localTime;
      }

      this.state_.current.localTime = time;
      effect.localTime = time;
    }

    calculatePhase(events) {
      for (let event of events) {
        switch (event.type) {
          case "pointerdown":
            if (this.state_.phase == "idle") {
              console.log("---- 👋 START ----");
            }
            this.state_.phase = "tracking";
            break;
          case "pointerup":
          case "pointerleave":
          case "pointercancel":
            if (this.state_.phase == "tracking") {
              const movement = this.state_.last.movement;
              this.state_.last.intertialDelta = movement ? movement.deltaX : 0;
              console.log("==== 👋 🛑 ====");
            }

            this.state_.phase = "finishing";
            this.state_.last.position = null;
            this.state_.target.localTime = this.calculateFinalTarget(
              this.state_.current.localTime
            );

            console.log(this.debugString());
            break;
        }
      }

      if (this.state_.phase == "finishing") {
        // switch to idle once we reach our target
        if (
          isNear(this.state_.current.localTime, this.state_.target.localTime)
        ) {
          console.log("==== 🐌 FINISHED 🐌 ====");
          this.state_.current.localTime = this.state_.target.localTime;
          this.state_.phase = "idle";
        }
      }

      return this.state_.phase;
    }

    // Parse events to compute movement
    processEvents(message) {
      let events = [],
        position = null,
        movement = { deltaX: 0, deltaY: 0 };

      if (message.length == 0) return { events, movement };

      events = JSON.parse(message);
      // Consider only position of the most event
      const recent_event = events[events.length - 1];
      // console.log(recent_event);
      position = { x: recent_event.screenX, y: recent_event.screenY };

      if (this.state_.last.position) {
        movement = {
          deltaX: position.x - this.state_.last.position.x,
          deltaY: position.y - this.state_.last.position.y
        };
        this.state_.last.movement = movement;
        //console.log("movement ", movement);
      }
      this.state_.last.position = position;

      return { events, movement };
    }

    calculateFinalTarget(localTime) {
      const start = 0;
      // TODO: This really should be effect.getLocalTiming().duration
      const end = this.maxPosition - this.targetWidth;
      const middle = (end - start) / 2;
      switch (this.releaseBehavior) {
        case "remain":
          return localTime;
        case "complete":
          return localTime < middle ? start : end;
        case "return":
          return start;
        default:
          throw "Invalid releaseBehavior";
      }
    }

    moveTowardFinalTargetWithVelocity() {
      // Curve to update  position get closer to the target
      // initially weigh more heavily on "movement" and over time
      // switch the distance gets smaller

      this.state_.last.intertialDelta *= 0.9;
      const inertialComponent = this.state_.last.intertialDelta;

      const current = this.state_.current.localTime;
      const target = this.state_.target.localTime;
      const distanceComponent = (target - current) / 10;

      return current + (distanceComponent + inertialComponent);
    }

    debugString() {
      return `currently at ${this.state_.current.localTime} - ${
        this.releaseBehavior
      } to ${this.state_.target.localTime}`;
    }

    state() {
      return this.state_;
    }
  }
);

function isNear(a, b) {
  if (Math.abs(a - b) < 0.5) return true;
}

console.log("Worklet code was processed.");
