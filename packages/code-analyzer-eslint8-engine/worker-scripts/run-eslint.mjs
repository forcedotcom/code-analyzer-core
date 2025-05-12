// Note that workerData is the data that the parent thread passes to this worker
import {parentPort, workerData} from "node:worker_threads";
import {ESLint} from "eslint";

const filesToScan = workerData.filesToScan;
const eslintOptions = workerData.eslintOptions;

const eslint = new ESLint(eslintOptions);

const lintResults = await eslint.lintFiles(filesToScan);

parentPort.postMessage(lintResults);