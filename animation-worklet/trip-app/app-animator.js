registerAnimator('image_reveal', class {
  constructor(options = {start:0, width:100, inverse: false}) {
      this.start_  = options.start;
      this.width_ = options.width;
      this.inverse_ = options.inverse;
  }
  animate(currentTime, effect) {
      if (isNaN(currentTime))
        return;

      const scrollOffset = currentTime;
      var progress = (this.start_ - scrollOffset) / this.width_;
      progress = clamp(1 - progress, 0, 1);
      var t;
      if (this.inverse_) {
        let currentScale = 0.5 + (0.5) * progress;
        let inverseScale = 1 / currentScale;
        t = inverseScale - 1;
      } else {
        t = progress * 100;
      }
      effect.localTime = t;
  }
});


registerAnimator('passthrough', class {
    animate(currentTime, effect) {
        effect.localTime = currentTime;
    }
});

registerAnimator('icon_effect_compositor', class {
  constructor(options) {
      this.start_ = options.start;
      this.width_ = options.width;
      this.play_when_favorited_ = options.play_when_favorited;

      this.favorited_ = false;
      this.commitedFavoriteState_ = false;
  }

  animate(currentTime, effect) {
    if (isNaN(currentTime))
      return;
    const scrollOffset = Math.round(currentTime);
    const delta = this.start_ - scrollOffset;
    const progress = delta / this.width_;

    if ((!this.favorited_ && !this.play_when_favorited_)  // play the scale animation
      || (this.favorited_ && this.play_when_favorited_)) { // play the transform animation
        effect.localTime = clamp(progress, 0,  1) * 100;
    }

    if (isNear(progress, 0) || progress < 0) {
      // Back to 0, commit the new state
      this.commitedFavoriteState_ = this.favorited_;
    } else if (isNear(progress, 1) || progress > 1 ) {
      // Passed threshold, toggle the state
      this.favorited_ = !this.commitedFavoriteState_;
    }
  }
});

registerAnimator('icon_effect_main', class {
  constructor(options) {
      this.start_ = options.general_options.start;
      this.width_ = options.general_options.width;
      this.play_when_favorited_for_scale_ = options.scale_options.play_when_favorited;
      this.play_when_favorited_for_background_scale_ = options.background_scale_options.play_when_favorited;
      this.play_when_favorited_for_transform_ = options.transform_options.play_when_favorited;

      this.favorited_ = false;
      this.commitedFavoriteState_ = false;
  }

  animate(currentTime, effect) {
    if (isNaN(currentTime))
      return;
    let effects = effect.getChildren();
    // effects[0]: scale
    // effects[1]: background scale
    // effects[2]: background color
    // effects[3]: transform
    const scrollOffset = Math.round(currentTime);
    const delta = this.start_ - scrollOffset;
    const progress = delta / this.width_;

    // Always play background animation
    effects[2].localTime = clamp(progress, 0,  1) * 100;
    if (!this.favorited_ && !this.play_when_favorited_for_scale_)  // play the scale animation
        effects[0].localTime = clamp(progress, 0,  1) * 100;
    if (!this.favorited_ && !this.play_when_favorited_for_background_scale_)  // play the background scale animation
        effects[1].localTime = clamp(progress, 0,  1) * 100;
    if (this.favorited_ && this.play_when_favorited_for_transform_) // play the transform animation
        effects[3].localTime = clamp(progress, 0,  1) * 100;

    if (isNear(progress, 0) || progress < 0) {
      // Back to 0, commit the new state
      this.commitedFavoriteState_ = this.favorited_;
    } else if (isNear(progress, 1) || progress > 1 ) {
      // Passed threshold, toggle the state
      this.favorited_ = !this.commitedFavoriteState_;
    }
  }
});

function clamp(value, min, max) {
  return Math.max(Math.min(value, max), min);
}

function isNear(a, b) {
  return Math.abs(a - b) < 1e-4;
}
