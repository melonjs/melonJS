export default DefaultLoadingScreen;
/**
 * a default loading screen
 * @ignore
 */
declare class DefaultLoadingScreen extends Stage {
    /**
     * call when the loader is resetted
     * @ignore
     */
    onResetEvent(): void;
    /**
     * Called by engine before deleting the object
     * @ignore
     */
    onDestroyEvent(): void;
}
import Stage from "./../state/stage.js";
