import {receiver} from './event-delegation.js'

registerAnimator('dnd', class {
  constructor(options, state){
    // console.log('construct animation worklet');
    this.receive = receiver(options.pipe);

    this.state_ = state || {
      phase: 'idle', // we have three phase: idle, finishing, tracking
      pointer_base: {x: 0, y: 0},
      lastMessage: ''
    }
  }

  animate(currentTime, effect) {
    let message = this.receive();
    if (message.length == 0 || message == this.state_.lastMessage)
      return;
    this.state_.lastMessage = message;
    const event = JSON.parse(message);


    // animate based on the effect phase and movement delta
    const {phase, movement} = this.calculatePhase(event);
    //console.log(`@worklet: received <==${message}`, phase, movement);

    if (phase == 'tracking') {
      effect.localTime = movement.deltaX;
      console.log(movement.deltaX, effect.localTime);

    } else {
      effect.localTime = 0;
    }

  }

  calculatePhase(event) {
    const position = {x: event.screenX, y: event.screenY};

    switch(event.type){
    case 'pointerdown':
      if (this.state_.phase == 'idle') {
        console.log('---- 👋 START ----');

        this.state_.pointer_base = position;
      }
      this.state_.phase = 'tracking';
      break;
    case 'pointerup':
    case 'pointerleave':
    case 'pointercancel':
      if (this.state_.phase == 'tracking')
        console.log('==== 👋 🛑 =====');
      this.state_.pointer_base = {x: 0, y: 0};
      this.state_.phase = 'idle';
      break;
    }

    const movement = {
      deltaX: position.x - this.state_.pointer_base.x,
      deltaY: position.y - this.state_.pointer_base.y
    }

    return {phase: this.state_.phase, movement: movement};
  }

  state() {
    return this.state_;
  }
});
