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
                option.appendChild(document.createTextNode(resource.name))
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