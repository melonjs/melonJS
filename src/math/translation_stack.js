(function () {
    me.TranslationStack = Object.extend({
        init: function () {
            this.stack = [];
            this.globalFloatingCounter = 0;
            this.rect = new me.Rect(0, 0, 0, 0);
            this.x = 0;
            this.y = 0;
            this.isTranslated = false;
            this.isStacked = false;
        },

        reset: function () {
            this.x = 0;
            this.y = 0;
            this.propertyVerification = 0;
        },

        translate: function (isFloating, obj) {
            // Translate global context
            this.isTranslated = !isFloating;
            if (isFloating) {
                this.globalFloatingCounter++;
            }
            if (this.isTranslated) {
                this.x = obj.pos.x;
                this.y = obj.pos.y;
                var propertyVerification = Math.abs(this.x + this.y + obj.width + obj.height);
                if (propertyVerification !== propertyVerification || propertyVerification === Infinity) {
                    this.isStacked = true;
                    this.stack.push(this.rect.clone());
                }
                this.rect.translateV(obj.pos);
                this.rect.resize(obj.width, obj.height);
            }
        },

        undoTranslation: function () {
            if (this.isTranslated) {
                if (this.isStacked) {
                    this.isStacked = false;
                    this.rect.copy(this.stack.pop());
                }
                else {
                    this.rect.translate(-this.x, -this.y);
                }
            }

            if (this.globalFloatingCounter > 0) {
                this.globalFloatingCounter--;
            }
        }
    });
})();