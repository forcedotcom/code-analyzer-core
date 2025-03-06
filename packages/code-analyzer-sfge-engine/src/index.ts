import {SfgeEnginePlugin} from './plugin';
import {EnginePlugin} from '@salesforce/code-analyzer-engine-api';

function createEnginePlugin(): EnginePlugin {
    return new SfgeEnginePlugin();
}

export {createEnginePlugin, SfgeEnginePlugin};