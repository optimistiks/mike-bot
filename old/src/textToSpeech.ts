import AWS, { Polly } from "aws-sdk";

const polly = new AWS.Polly();

export async function textToSpeech(text: string): Promise<Polly.AudioStream> {
  const audioBuffer = await new Promise<Polly.AudioStream>(
    (resolve, reject) => {
      polly.synthesizeSpeech(
        { Text: text, VoiceId: "Maxim", OutputFormat: "mp3" },
        (err, data) => {
          if (err) {
            return reject(err);
          }
          resolve(data.AudioStream);
        }
      );
    }
  );
  return audioBuffer;
}
