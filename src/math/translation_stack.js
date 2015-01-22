(function () {
    me.TranslationStack = Object.extend({
        init: function () {
            this.stack = [];
            this.globalFloatingCounter = 0;
            this.rect = new me.Rect(0, 0, 0, 0);
            this.isTranslated = false;
            this.isStacked = false;
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
                var propertyVerification = Math.abs(obj.pos.x + obj.pos.y + obj.width + obj.height);
                if (propertyVerification !== propertyVerification || propertyVerification === Infinity) {
                    this.stack.push({ pos: this.rect.pos.clone(), width: this.rect.width, height: this.rect.height, isStacked: true });
                }
                else {
                    this.stack.push({ pos: obj.pos.clone(), width: obj.width, height: obj.height, isStacked: false });
                }
                this.rect.translateV(obj.pos);
                this.rect.resize(obj.width, obj.height);
            }
        },

        undoTranslation: function () {
            if (this.isTranslated) {
                var last = this.stack.pop();
                if (last.isStacked) {
                    this.rect.setShap(last.pos.x, last.pos.y, last.width, last.height);
                }
                else {
                    this.rect.translate(-last.pos.x, -last.pos.y);
                    this.rect.resize(last.width, last.height);
                }
            }

            if (this.globalFloatingCounter > 0) {
                this.globalFloatingCounter--;
            }
        }
    });
})();