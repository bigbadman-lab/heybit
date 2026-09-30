import "./lib/bootstrap.js";
import { LAUNCH_ACTIVATE_MESSAGE, refuse } from "./lib/refuse.js";

process.exit(refuse(LAUNCH_ACTIVATE_MESSAGE));
