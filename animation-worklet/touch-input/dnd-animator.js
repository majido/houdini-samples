import { receiver } from "./event-delegation.js";

registerAnimator(
  "dnd",
  class {
    constructor(options, state) {
      // console.log('construct animation worklet');
      this.receive = receiver(options.pipe);
      this.releaseBehavior = options.releaseBehavior;

      this.state_ = state || {
        // we have three phase: idle, finishing, tracking
        phase: "idle",
        //pointerOrigin: { x: 0, y: 0 },
        // track localTime when we transition to idle to ensure the effect is persistent
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
          movement: null
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

      let event = null,
        position = null,
        movement = { deltaX: 0, deltaY: 0 };

      if (message.length != 0) {
        event = JSON.parse(message);
        position = { x: event.screenX, y: event.screenY };

        if (this.state_.last.position) {
          movement = {
            deltaX: position.x - this.state_.last.position.x,
            deltaY: position.y - this.state_.last.position.y
          };
          this.state_.last.movement = movement;
          console.log("movement ", movement);
        }
        this.state_.last.position = position;
      }

      // Update the phase based
      const phase = this.calculatePhase(event, effect.localTime);
      //console.log(`@worklet: received <==${message}`, phase, movement);

      // Animate based on the phase and pointer movement
      let time;
      switch (phase) {
        case "tracking":
          // const deltaX = event.screenX - this.state_.pointerOrigin.screenX;
          time = this.state_.current.localTime + movement.deltaX;
          break;
        case "finishing":
          // TODO: make this time based animated
          // time = this.state_.current.localTime;
          // // Move half the distance toward target.
          // // But will Achillies ever reach its target...
          // time += (this.state_.target.localTime - time) / 10;
          time = this.moveTowardFinalTargetWithVelocity();
          break;
        case "idle":
          time = this.state_.current.localTime;
      }

      this.state_.current.localTime = time;
      effect.localTime = time;
    }

    calculatePhase(event, localTime) {
      if (event) {
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
              console.log("==== 👋 🛑 =====");
            }

            this.state_.phase = "finishing";
            this.state_.last.position = null;
            this.state_.target.localTime = this.calculateFinalTarget(localTime);
            console.log(
              `${this.releaseBehavior} to ${
                this.state_.target.localTime
              }  from ${this.state_.current.localTime}`
            );

            break;
        }
      }

      if (this.state_.phase == "finishing") {
        console.log("finishing");
        // switch to idle once we reach our target
        if (
          isNear(this.state_.current.localTime, this.state_.target.localTime)
        ) {
          this.state_.current.localTime = this.state_.target.localTime;
          this.state_.phase = "idle";
        }
      }

      return this.state_.phase;
    }

    calculateFinalTarget(localTime) {
      const start = 0;
      // TODO: This really should be effect.getLocalTiming().duration
      const end = 300;
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

      const movement = this.state_.last.movement;
      if (movement) {
        movement.deltaX = Math.floor(movement.deltaX * 0.9);
      }
      const inertialComponent = movement ? movement.deltaX : 0;

      const current = this.state_.current.localTime;
      const target = this.state_.target.localTime;
      const distanceComponent = (target - current) / 20;

      return current + (distanceComponent + inertialComponent);
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
