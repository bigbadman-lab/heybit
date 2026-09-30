import "./lib/bootstrap.js";
import { BIT_DEX_PAID_MESSAGE, refuse } from "./lib/refuse.js";

process.exit(refuse(BIT_DEX_PAID_MESSAGE));
