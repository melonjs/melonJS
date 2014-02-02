game.ParticleEditor = game.ParticleEditor || {};
game.ParticleEditor.WidgetBase = Object.extend({
    init : function(object, propertyName) {
        this.object = object;
        this.propertyPath = propertyName.split(".");
        this.propertyName = this.propertyPath.pop();
        this.rootNode = document.createElement("div");
    },
    getPropertyValue : function() {
        var object = this._getNestedObject();
        return object[this.propertyName];
    },
    setPropertyValue : function(value) {
        var object = this._getNestedObject(), propertyName = this.propertyName;
        if (object[propertyName] !== value) {
            object[propertyName] = value;
            me.event.publish("emitterChanged", [ this.object ]);
        }
    },
    _getNestedObject : function() {
        var object = this.object;
        for ( var i = 0, propertyPath = this.propertyPath, length = propertyPath.length; i < length; ++i) {
            object = object[propertyPath[i]];
        }
        return object;
    },
    sync : function() {
        console.warn("sync is not implemented yet");
    },
    appendTo : function(container) {
        container.appendChild(this.rootNode);
    }
});

game.ParticleEditor.FloatInputWidget = game.ParticleEditor.WidgetBase.extend({
    init : function(object, propertyName) {
        this.parent(object, propertyName);
        var root = this.rootNode;
        var label = document.createElement("label");
        var input = this.input = document.createElement("input");
        input.setAttribute("type", "number");
        input.setAttribute("step", "any");
        input.addEventListener("change", this.onChange.bind(this));
        label.appendChild(document.createTextNode(propertyName))
        label.appendChild(input)
        root.appendChild(label);
    },
    onChange : function() {
        if (this.input.validity.valid) {
            this.setPropertyValue(this.input.value);
        }
    },
    sync : function() {
        this.input.value = this.getPropertyValue();
    }
});

game.ParticleEditor.IntegerInputWidget = game.ParticleEditor.WidgetBase.extend({
    init : function(object, propertyName) {
        this.parent(object, propertyName);
        var root = this.rootNode;
        var label = document.createElement("label");
        var input = this.input = document.createElement("input");
        input.setAttribute("type", "number");
        input.setAttribute("step", "1");
        input.addEventListener("change", this.onChange.bind(this));
        label.appendChild(document.createTextNode(propertyName))
        label.appendChild(input)
        root.appendChild(label);
    },
    onChange : function() {
        if (this.input.validity.valid) {
            this.setPropertyValue(this.input.value);
        }
    },
    sync : function() {
        this.input.value = this.getPropertyValue();
    }
});

game.ParticleEditor.TextInputWidget = game.ParticleEditor.WidgetBase.extend({
    init : function(object, propertyName) {
        this.parent(object, propertyName);
        var root = this.rootNode;
        var label = document.createElement("label");
        var input = this.input = document.createElement("input");
        input.setAttribute("type", "text");
        input.addEventListener("change", this.onChange.bind(this));
        label.appendChild(document.createTextNode(propertyName))
        label.appendChild(input)
        root.appendChild(label);
    },
    onChange : function() {
        if (this.input.validity.valid) {
            this.setPropertyValue(this.input.value);
        }
    },
    sync : function() {
        this.input.value = this.getPropertyValue();
    }
});

game.ParticleEditor.BooleanInputWidget = game.ParticleEditor.WidgetBase.extend({
    init : function(object, propertyName) {
        this.parent(object, propertyName);
        var root = this.rootNode;
        var label = document.createElement("label");
        var input = this.input = document.createElement("input");
        input.setAttribute("type", "checkbox");
        input.addEventListener("change", this.onChange.bind(this));
        label.appendChild(document.createTextNode(propertyName))
        label.appendChild(input)
        root.appendChild(label);
    },
    onChange : function() {
        this.setPropertyValue(this.input.checked);
    },
    sync : function() {
        this.input.checked = this.getPropertyValue();
    }
});

game.ParticleEditor.ImageSelectionWidget = game.ParticleEditor.WidgetBase.extend({
    init : function(object, propertyName, resourceList) {
        this.parent(object, propertyName);
        var root = this.rootNode;
        var label = document.createElement("label");
        var select = this.select = document.createElement("select");
        select.addEventListener("change", this.onChange.bind(this));
        this.resourceList = resourceList = resourceList || game.resources || [];
        for ( var i = 0, length = resourceList.length, resource, option; i < length; ++i) {
            resource = resourceList[i];
            if (resource.type === "image") {
                option = document.createElement("option");
                option.setAttribute("value", resource.name);
                option.appendChild(document.createTextNode(resource.name));
                select.appendChild(option);
            }
        }
        label.appendChild(document.createTextNode(propertyName))
        label.appendChild(select)
        root.appendChild(label);
    },
    onChange : function() {
        var image = me.loader.getImage(this.select.value);
        this.setPropertyValue(image);
    },
    sync : function() {
        var image = this.getPropertyValue();
        resourceList = this.resourceList;
        for ( var i = 0, length = resourceList.length, resource; i < length; ++i) {
            resource = resourceList[i];
            if (image === me.loader.getImage(resource.name)) {
                this.select.selectedIndex = i;
                break;
            }
        }
    }
});

game.ParticleEditor.ShapeWidget = game.ParticleEditor.WidgetBase.extend({
    init : function(object) {
        this.parent(object, "");

        this.shapeHelper = new game.ParticleEditor.ShapeWidget.Helper(object);
        this.sizeDragHandler = new game.ParticleEditor.ShapeWidget.DragHandler(object);
        this.sizeDragHandler.onDrag = this.onDrag.bind(this);

        me.game.world.addChild(this.shapeHelper);
        me.game.world.addChild(this.sizeDragHandler);
    },
    onDrag : function(pos) {
        var object = this.object;
        if (object) {
            pos.sub(object.pos).clampSelf(0, Infinity);
            object.resize(pos.x * 2, pos.y * 2);
            me.event.publish("emitterChanged", [ object ]);
        }
    },
    onChange : function() {
    },
    sync : function() {
        var object = this.object;
        if (object) {
            this.shapeHelper.setShape(object.pos, object.width, object.height);
            this.sizeDragHandler.setPosition(object.pos.x + object.hWidth, object.pos.y + object.hHeight);
        }
    }
});

game.ParticleEditor.ShapeWidget.Helper = me.Renderable.extend({
    init : function(object) {
        if (object) {
            this.parent(object.pos, object.width, object.height);
        } else {
            this.parent(new me.Vector2d(0, 0), 0, 0);
        }
        this.z = Infinity;
    },
    draw : function(context, rect) {
        context.strokeStyle = "#f00";
        context.strokeRect(this.pos.x - this.hWidth, this.pos.y - this.hHeight, this.width, this.height);
    }
});

game.ParticleEditor.ShapeWidget.DragHandler = me.Renderable.extend({
    init : function() {
        this.originalSize = 40;
        this.parent(new me.Vector2d(0, 0), this.originalSize, this.originalSize);
        this.z = Infinity;
        this.dragging = false;
        this.grabOffset = new me.Vector2d(0, 0);
        this.floating = true;
        me.input.registerPointerEvent("mousedown", this, this.startDrag.bind(this));
        me.input.registerPointerEvent("mouseup", me.game.viewport, this.stopDrag.bind(this));
        me.input.registerPointerEvent("mousemove", me.game.viewport, this.drag.bind(this));
    },
    setPosition : function(x, y) {
        this.pos.set(x - this.hWidth, y - this.hHeight);
    },
    startDrag : function(event) {
        this.dragging = true;

        var size = this.originalSize / 2;
        this.resize(size, size);
        size /= 2;
        this.translate(size, size);

        var mousepos = me.input.mouse.pos;
        var x = mousepos.x - this.pos.x;
        var y = mousepos.y - this.pos.y;
        this.grabOffset.set(x, y);
    },
    stopDrag : function() {
        if (this.dragging) {
            this.dragging = false;
            var size = this.originalSize;
            this.resize(size, size);
            size /= -4;
            this.translate(size, size);
        }
    },
    drag : function(event) {
        if (this.dragging) {
            var pos = me.input.mouse.pos.clone().sub(this.grabOffset);
            pos.x += this.hWidth;
            pos.y += this.hHeight;
            this.onDrag(pos);
            return false;
        }
    },
    onDrag : function(pos) {
    },
    draw : function(context, rect) {
        context.strokeStyle = "#f00";
        context.fillStyle = "rgba(255, 0, 0, 0.3)";
        context.beginPath();
        context.arc(this.pos.x + this.hWidth, this.pos.y + this.hHeight, this.hWidth, 0, Math.PI * 2);
        context.stroke();
        context.fill();
        context.closePath();
    }
});