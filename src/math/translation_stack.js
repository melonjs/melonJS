(function () {
    me.TranslationStack = Object.extend({
        init: function () {
            this.stack = [];
            this.globalFloatingCounter = 0;
            this.rect = new me.Rect(0, 0, 0, 0);
            this.isTranslated = false;
            this.isStacked = false;
            this.translationStack = [];
        },

        fullReset: function () {
            this.translationStack = [];
            this.propertyVerification = 0;
            this.rect.setShape(0, 0, 0, 0);
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
                this.translationStack.push(obj.pos.clone());
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
                    var v = this.translationStack.pop();
                    this.rect.translate(-v.x, -v.y);
                }
            }

            if (this.globalFloatingCounter > 0) {
                this.globalFloatingCounter--;
            }
        }
    });
})();