import {receiver} from './event-delegation.js'

registerAnimator('dnd', class {
  constructor(options, state){
    // console.log('construct animation worklet');
    this.receive = receiver(options.pipe);
    this.lastMessage = state ? state.lastMessage : '';
    //console.log(state, this.lastInput)

  }

  animate(currentTime, effect) {
    let message = this.receive();
    if (message.length == 0 || message == this.lastMessage)
      return;
    this.lastMessage = message;
    const event = JSON.parse(message);

    console.log(`@worklet: received <==${message}`, event);

    effect.localTime = currentTime;
  }

  state() {
    return {
      lastMessage: this.lastMessage
    }
  }
});
