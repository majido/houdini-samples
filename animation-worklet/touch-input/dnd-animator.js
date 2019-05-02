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
        pointerOrigin: { x: 0, y: 0 },
        // track localTime when we transition to idle to ensure the effect is persistent
        localTimeOrigin: 0,
        lastMessage: ""
      };
    }

    animate(currentTime, effect) {
      let message = this.receive();
      if (message.length == 0 || message == this.state_.lastMessage) return;
      this.state_.lastMessage = message;
      const event = JSON.parse(message);

      // Update the phase based
      const phase = this.calculatePhase(event, effect.localTime);
      //console.log(`@worklet: received <==${message}`, phase, movement);

      // Animate based on the phase and pointer movement
      if (phase == "tracking") {
        const deltaX = event.screenX - this.state_.pointerOrigin.screenX;
        effect.localTime = this.state_.localTimeOrigin + deltaX;
        //console.log(deltaX, effect.localTime);
      } else if (phase == "finishing") {
      } else if (phase == "idle") {
        // TODO: make this time based animated
        effect.localTime = this.state_.localTimeOrigin;
      }
    }

    calculatePhase(event, localTime) {
      switch (event.type) {
        case "pointerdown":
          if (this.state_.phase == "idle") {
            console.log("---- 👋 START ----");

            this.state_.pointerOrigin = {
              screenX: event.screenX,
              screenY: event.screenY
            };
          }
          this.state_.phase = "tracking";
          break;
        case "pointerup":
        case "pointerleave":
        case "pointercancel":
          if (this.state_.phase == "tracking") {
            console.log("==== 👋 🛑 =====");
          }

          this.state_.phase = "idle";
          this.state_.pointerOrigin = { x: 0, y: 0 };
          this.state_.localTimeOrigin = this.calculateFinalTarget(localTime);
          console.log(
            `${this.releaseBehavior} @ ${this.state_.localTimeOrigin}`
          );

          break;
      }

      return this.state_.phase;
    }

    calculateFinalTarget(localTime) {
      const start = 0;
      // TODO: This really should be effect.getLocalTiming().duration
      const end = 200;
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

    state() {
      return this.state_;
    }
  }
);

console.log("Worklet code was processed.");