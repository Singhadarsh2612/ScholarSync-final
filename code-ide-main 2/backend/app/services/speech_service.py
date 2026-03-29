import os
import base64
from dotenv import load_dotenv
import azure.cognitiveservices.speech as speechsdk

load_dotenv()


def get_speech_config():
    speech_key = os.environ.get("AZURE_SPEECH_KEY")
    region = os.environ.get("AZURE_SPEECH_REGION")

    if not speech_key:
        return None

    if region:
        speech_config = speechsdk.SpeechConfig(
            subscription=speech_key,
            region=region
        )
    else:
        endpoint = os.environ.get("AZURE_SPEECH_ENDPOINT")
        if not endpoint:
            return None
        speech_config = speechsdk.SpeechConfig(
            subscription=speech_key,
            endpoint=endpoint
        )

    speech_config.speech_synthesis_voice_name = "en-US-ChristopherNeural"
    return speech_config


def text_to_speech_base64(text: str):
    speech_config = get_speech_config()

    if not speech_config:
        print("Azure Speech disabled: missing credentials.")
        return None

    synthesizer = speechsdk.SpeechSynthesizer(
        speech_config=speech_config,
        audio_config=None  # returns audio in memory, not to speaker
    )

    result = synthesizer.speak_text_async(text).get()

    if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
        audio_base64 = base64.b64encode(result.audio_data).decode("utf-8")
        return audio_base64
    elif result.reason == speechsdk.ResultReason.Canceled:
        cancellation = result.cancellation_details
        print(f"TTS canceled: {cancellation.reason}")
        if cancellation.reason == speechsdk.CancellationReason.Error:
            print(f"Text to speech  error details: {cancellation.error_details}")

    return None


def speech_to_text():
    speech_config = get_speech_config()

    if not speech_config:
        print("Azure Speech disabled: missing credentials.")
        return None

    speech_config.speech_recognition_language = "en-US"

    audio_config = speechsdk.audio.AudioConfig(use_default_microphone=True)

    recognizer = speechsdk.SpeechRecognizer(
        speech_config=speech_config,
        audio_config=audio_config
    )

    print("Speak into your microphone.")
    result = recognizer.recognize_once_async().get()

    if result.reason == speechsdk.ResultReason.RecognizedSpeech:
        return result.text
    elif result.reason == speechsdk.ResultReason.NoMatch:
        print(f"STT no match: {result.no_match_details}")
    elif result.reason == speechsdk.ResultReason.Canceled:
        cancellation = result.cancellation_details
        print(f"STT canceled: {cancellation.reason}")
        if cancellation.reason == speechsdk.CancellationReason.Error:
            print(f"Speech to text  error details: {cancellation.error_details}")

    return None