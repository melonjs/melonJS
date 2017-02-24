/**
 * Whack-A-Mole
 * Freely reused from the Cocos2d Whack-a-mole Tutorial
 * http://maniacdev.com/2011/01/tutorial-cocos2d-example-whack-a-mole-game/
 * Original version by Ray Wenderlich, the creator of the Space Game Starter
 * Kit and co-author of the Learning Cocos2D book, as part of an excellent set
 * of iOS tutorials on how to create a whack-a-mole game using the open source
 * iPhone game engine Cocos2D.
 **/
game.resources = [
    // background
    { name: "background", type: "image", src: "data/img/background/bg_dirt128.png" },
    // upper part of foreground
    { name: "grass_upper", type: "image", src: "data/img/foreground/grass_upper128.png" },
    // lower part of foreground
    { name: "grass_lower", type: "image", src: "data/img/foreground/grass_lower128.png" },
    // more sprites
    { name: "mole", type: "image", src: "data/img/sprites/mole.png" },

    // bitmap font
    { name: "PressStart2P", type:"image", src: "data/fnt/PressStart2P.png" },
    { name: "PressStart2P", type:"binary", src: "data/fnt/PressStart2P.fnt"},

    // main music track
    { name: "whack", type: "audio", src: "data/bgm/" },
    // Laugh audio FX
    /*{ name: "laugh", type: "audio", src: "data/sfx/" },*/
    // ow audio FX
    { name: "ow", type: "audio", src: "data/sfx/" }
];
