import "./lib/bootstrap.js";
import { checkOpenAi, formatOpenAiCheck } from "../apps/worker/src/openai-reactions.js";

const check = await checkOpenAi(process.env);
process.stdout.write(formatOpenAiCheck(check));
process.exit(check.verdict === "PASS" ? 0 : 1);
