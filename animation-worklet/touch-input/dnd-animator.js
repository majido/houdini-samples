import { receiver } from "./event-delegation.js";

registerAnimator(
  "dnd",
  class {
    constructor(options, state) {
      // console.log('construct animation worklet');
      this.receive = receiver(options.pipe);
      this.releaseBehavior = options.releaseBehavior;

      this.state_ = state || {
        phase: "idle", // we have three phase: idle, finishing, tracking
        pointerOrigin: { x: 0, y: 0 },
        localTimeOrigin: 0, // track localTime when we transition to idle to ensure the effect is persistent
        lastMessage: ""
      };
    }

    animate(currentTime, effect) {
      let message = this.receive();
      if (message.length == 0 || message == this.state_.lastMessage) return;
      this.state_.lastMessage = message;
      const event = JSON.parse(message);

      // animate based on the effect phase and movement delta
      const { phase, movement} = this.calculatePhase(event, effect.localTime);
      //console.log(`@worklet: received <==${message}`, phase, movement);

      if (phase == "tracking") {
        effect.localTime = this.state_.localTimeOrigin + movement.deltaX;
        console.log(movement.deltaX, effect.localTime);
      } else {
        // TODO: make this time based animated
        effect.localTime = this.state_.localTimeOrigin;
      }
    }

    calculatePhase(event, localTime) {
      const position = { x: event.screenX, y: event.screenY };

      switch (event.type) {
        case "pointerdown":
          if (this.state_.phase == "idle") {
            console.log("---- 👋 START ----");

            this.state_.pointerOrigin = position;
          }
          this.state_.phase = "tracking";
          break;
        case "pointerup":
        case "pointerleave":
        case "pointercancel":
          if (this.state_.phase == "tracking") console.log("==== 👋 🛑 =====");

          this.state_.phase = "idle";
          this.state_.pointerOrigin = { x: 0, y: 0 };

          if (this.releaseBehavior == 'stay')
            this.state_.localTimeOrigin = localTime;
          else
            this.state_.localTimeOrigin = 0;

          break;
      }

      const movement = {
        deltaX: position.x - this.state_.pointerOrigin.x,
        deltaY: position.y - this.state_.pointerOrigin.y
      };

      return { phase: this.state_.phase, movement: movement };
    }

    state() {
      return this.state_;
    }
  }
);