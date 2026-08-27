import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
// The captures are VP8 webm; Remotion decodes them off-thread via OffthreadVideo.
Config.setConcurrency(4);
