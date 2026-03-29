import os
import azure.cognitiveservices.speech as speechsdk
from dotenv import load_dotenv

load_dotenv()

def test_region(key, region):
    print(f"\n--- Testing Region: {region} ---")
    try:
        speech_config = speechsdk.SpeechConfig(subscription=key, region=region)
        speech_config.speech_synthesis_voice_name = "en-US-ChristopherNeural"
        
        # Try forcing a specific transport or timeout
        # speech_config.set_property(speechsdk.PropertyId.SpeechServiceConnection_ProxyHost, "none")
        
        synthesizer = speechsdk.SpeechSynthesizer(speech_config=speech_config, audio_config=None)
        result = synthesizer.speak_text_async("Test").get()
        
        if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
            print(f"SUCCESS in {region}!")
            return True
        elif result.reason == speechsdk.ResultReason.Canceled:
            details = result.cancellation_details
            print(f"Canceled in {region}: {details.reason}")
            if details.reason == speechsdk.CancellationReason.Error:
                print(f"Error: {details.error_details}")
        else:
            print(f"Failed in {region} with reason: {result.reason}")
    except Exception as e:
        print(f"Exception in {region}: {e}")
    return False

def diagnose_all():
    key = os.getenv("AZURE_SPEECH_KEY")
    current_region = os.getenv("AZURE_SPEECH_REGION")
    
    regions = [current_region, "centralindia", "eastus", "westus", "southcentralus"]
    regions = list(dict.fromkeys(regions)) # unique
    
    for r in regions:
        if r:
            if test_region(key, r):
                print(f"\nFIX FOUND: Use region {r}")
                break

if __name__ == "__main__":
    diagnose_all()
