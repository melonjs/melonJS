export default state;
declare namespace state {
    let LOADING: number;
    let MENU: number;
    let READY: number;
    let PLAY: number;
    let GAMEOVER: number;
    let GAME_END: number;
    let SCORE: number;
    let CREDITS: number;
    let SETTINGS: number;
    let DEFAULT: number;
    let USER: number;
    /**
     * Stop the current stage.
     * @name stop
     * @memberof state
     * @public
     * @param {boolean} [pauseTrack=false] - pause current track on screen stop.
     */
    function stop(pauseTrack?: boolean | undefined): void;
    /**
     * pause the current stage
     * @name pause
     * @memberof state
     * @public
     * @param {boolean} [music=false] - pause current music track on screen pause
     */
    function pause(music?: boolean | undefined): void;
    /**
     * Restart the current stage from a full stop.
     * @name restart
     * @memberof state
     * @public
     * @param {boolean} [music=false] - resume current music track on screen resume
     */
    function restart(music?: boolean | undefined): void;
    /**
     * resume the current stage
     * @name resume
     * @memberof state
     * @public
     * @param {boolean} [music=false] - resume current music track on screen resume
     */
    function resume(music?: boolean | undefined): void;
    /**
     * return the running state of the state manager
     * @name isRunning
     * @memberof state
     * @public
     * @returns {boolean} true if a "process is running"
     */
    function isRunning(): boolean;
    /**
     * Return the pause state of the state manager
     * @name isPaused
     * @memberof state
     * @public
     * @returns {boolean} true if the game is paused
     */
    function isPaused(): boolean;
    /**
     * associate the specified state with a Stage
     * @name set
     * @memberof state
     * @public
     * @param {number} state - State ID (see constants)
     * @param {Stage} stage - Instantiated Stage to associate with state ID
     * @param {boolean} [start = false] - if true the state will be changed immediately after adding it.
     * @example
     * class MenuButton extends me.GUI_Object {
     *     onClick() {
     *         // Change to the PLAY state when the button is clicked
     *         me.state.change(me.state.PLAY);
     *         return true;
     *     }
     * };
     *
     * class MenuScreen extends me.Stage {
     *     onResetEvent() {
     *         // Load background image
     *         me.game.world.addChild(
     *             new me.ImageLayer(0, 0, {
     *                 image : "bg",
     *                 z: 0 // z-index
     *             }
     *         );
     *
     *         // Add a button
     *         me.game.world.addChild(
     *             new MenuButton(350, 200, { "image" : "start" }),
     *             1 // z-index
     *         );
     *
     *         // Play music
     *         me.audio.playTrack("menu");
     *     }
     *
     *     onDestroyEvent() {
     *         // Stop music
     *         me.audio.stopTrack();
     *     }
     * };
     *
     * me.state.set(me.state.MENU, new MenuScreen());
     */
    function set(state: number, stage: Stage, start?: boolean | undefined): void;
    /**
     * returns the stage associated with the specified state
     * (or the current one if none is specified)
     * @name set
     * @memberof state
     * @public
     * @param {number} [state] - State ID (see constants)
     * @returns {Stage}
     */
    function get(state?: number | undefined): Stage;
    /**
     * return a reference to the current stage<br>
     * useful to call a object specific method
     * @name current
     * @memberof state
     * @public
     * @returns {Stage}
     */
    function current(): Stage;
    /**
     * specify a global transition effect
     * @name transition
     * @memberof state
     * @public
     * @param {string} effect - (only "fade" is supported for now)
     * @param {Color|string} color - a CSS color value
     * @param {number} [duration=1000] - expressed in milliseconds
     */
    function transition(effect: string, color: Color | string, duration?: number | undefined): void;
    /**
     * enable/disable the transition to a particular state (by default enabled for all)
     * @name setTransition
     * @memberof state
     * @public
     * @param {number} state - State ID (see constants)
     * @param {boolean} enable
     */
    function setTransition(state: number, enable: boolean): void;
    /**
     * change the game/app state
     * @name change
     * @memberof state
     * @public
     * @param {number} state - State ID (see constants)
     * @param {boolean} forceChange - if true the state will be changed immediately
     * @param {...*} [args] - extra arguments to be passed to the reset functions
     * @example
     * // The onResetEvent method on the play screen will receive two args:
     * // "level_1" and the number 3
     * me.state.change(me.state.PLAY, "level_1", 3);
     */
    function change(state: number, forceChange: boolean, ...args: any[]): void;
    /**
     * return true if the specified state is the current one
     * @name isCurrent
     * @memberof state
     * @public
     * @param {number} state - State ID (see constants)
     * @returns {boolean} true if the specified state is the current one
     */
    function isCurrent(state: number): boolean;
}
import Stage from "./../state/stage.js";
