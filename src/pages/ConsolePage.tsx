const LOCAL_RELAY_SERVER_URL: string =
  process.env.REACT_APP_LOCAL_RELAY_SERVER_URL || '';

import { useEffect, useRef, useCallback, useState } from 'react';

import { RealtimeClient } from '@openai/realtime-api-beta';
import { ItemType } from '@openai/realtime-api-beta/dist/lib/client.js';
import { WavRecorder, WavStreamPlayer } from '../lib/wavtools/index.js';
import { instructions } from '../utils/conversation_config.js';
import { WavRenderer } from '../utils/wav_renderer';

import { X, Edit, Zap, ArrowUp, ArrowDown } from 'react-feather';
import { Button } from '../components/button/Button';
import { Toggle } from '../components/toggle/Toggle';
import { Map } from '../components/Map';

import './ConsolePage.scss';
import { isJsxOpeningLikeElement } from 'typescript';

interface Coordinates {
  lat: number;
  lng: number;
  location?: string;
  temperature?: {
    value: number;
    units: string;
  };
  wind_speed?: {
    value: number;
    units: string;
  };
}


interface RealtimeEvent {
  time: string;
  source: 'client' | 'server';
  count?: number;
  event: { [key: string]: any };
}

export function ConsolePage() {
  const temperatureRef = useRef<{ value: number; units: string } | null>(null);
  const whatRef = useRef<{ value: string;} | null>(null);
  const whereRef = useRef<{ value: string;} | null>(null);
  const howRef = useRef<{ value: string;} | null>(null);
  const whenRef = useRef<{ value: string;} | null>(null);
  const howmanyRef = useRef<{ value: string;} | null>(null);
  const apiKey = LOCAL_RELAY_SERVER_URL
    ? ''
    : localStorage.getItem('tmp::voice_api_key') ||
      prompt('OpenAI API Key') ||
      '';
  if (apiKey !== '') {
    localStorage.setItem('tmp::voice_api_key', apiKey);
  }

  const wavRecorderRef = useRef<WavRecorder>(
    new WavRecorder({ sampleRate: 24000 })
  );
  const wavStreamPlayerRef = useRef<WavStreamPlayer>(
    new WavStreamPlayer({ sampleRate: 24000 })
  );
  const clientRef = useRef<RealtimeClient>(
    new RealtimeClient(
      LOCAL_RELAY_SERVER_URL
        ? { url: LOCAL_RELAY_SERVER_URL }
        : {
            apiKey: apiKey,
            dangerouslyAllowAPIKeyInBrowser: true,
          }
    )
  );

  const clientCanvasRef = useRef<HTMLCanvasElement>(null);
  const serverCanvasRef = useRef<HTMLCanvasElement>(null);
  const eventsScrollHeightRef = useRef(0);
  const eventsScrollRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<string>(new Date().toISOString());

  const [items, setItems] = useState<ItemType[]>([]);
  const [realtimeEvents, setRealtimeEvents] = useState<RealtimeEvent[]>([]);
  const [expandedEvents, setExpandedEvents] = useState<{
    [key: string]: boolean;
  }>({});
  const Favrite_food = "Tomatoes";
  const [isConnected, setIsConnected] = useState(false);
  const [canPushToTalk, setCanPushToTalk] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [memoryKv, setMemoryKv] = useState<{ [key: string]: any }>({});
  const [coords, setCoords] = useState<Coordinates | null>({
    lat: 37.775593,
    lng: -122.418137,
  });
  const [marker, setMarker] = useState<Coordinates | null>(null);
  
 
  const initialData = {
    What: "",
    Where: "",
    How: "",
    when: "",
    howmany: ""
  };
  const [inputData, setInputData] = useState(initialData);
  const testy = {
    value: inputData.What,
    units: inputData.Where,
  };
  const dummy = {
    value: 666,
    units: "°K",
  };
  const temperature = testy;
  


  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setInputData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const formatTime = useCallback((timestamp: string) => {
    const startTime = startTimeRef.current;
    const t0 = new Date(startTime).valueOf();
    const t1 = new Date(timestamp).valueOf();
    const delta = t1 - t0;
    const hs = Math.floor(delta / 10) % 100;
    const s = Math.floor(delta / 1000) % 60;
    const m = Math.floor(delta / 60_000) % 60;
    const pad = (n: number) => {
      let s = n + '';
      while (s.length < 2) {
        s = '0' + s;
      }
      return s;
    };
    return `${pad(m)}:${pad(s)}.${pad(hs)}`;
  }, []);

  const resetAPIKey = useCallback(() => {
    const apiKey = prompt('OpenAI API Key');
    if (apiKey !== null) {
      localStorage.clear();
      localStorage.setItem('tmp::voice_api_key', apiKey);
      window.location.reload();
    }
  }, []);

  const connectConversation = useCallback(async () => {
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    const wavStreamPlayer = wavStreamPlayerRef.current;

    startTimeRef.current = new Date().toISOString();
    setIsConnected(true);
    setRealtimeEvents([]);
    setItems(client.conversation.getItems());

    await wavRecorder.begin();
    await wavStreamPlayer.connect();
    await client.connect();
    client.sendUserMessageContent([
      {
        type: `input_text`,
        text: `Hello! hey i just updated all my answers in the input boxes can you check all my answers in the input boxes`,
      },
    ]);

    if (client.getTurnDetectionType() === 'server_vad') {
      await wavRecorder.record((data) => client.appendInputAudio(data.mono));
    }
  }, []);

  const disconnectConversation = useCallback(async () => {
    setIsConnected(false);
    setRealtimeEvents([]);
    setItems([]);
    setMemoryKv({});

    const client = clientRef.current;
    client.disconnect();

    const wavRecorder = wavRecorderRef.current;
    await wavRecorder.end();

    const wavStreamPlayer = wavStreamPlayerRef.current;
    await wavStreamPlayer.interrupt();
  }, []);

  const deleteConversationItem = useCallback(async (id: string) => {
    const client = clientRef.current;
    client.deleteItem(id);
  }, []);

  const startRecording = async () => {
    setIsRecording(true);
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    const wavStreamPlayer = wavStreamPlayerRef.current;
    const trackSampleOffset = await wavStreamPlayer.interrupt();
    if (trackSampleOffset?.trackId) {
      const { trackId, offset } = trackSampleOffset;
      await client.cancelResponse(trackId, offset);
    }
    await wavRecorder.record((data) => client.appendInputAudio(data.mono));
  };

  const stopRecording = async () => {
    setIsRecording(false);
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    await wavRecorder.pause();
    client.createResponse();
  };

  const changeTurnEndType = async (value: string) => {
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    if (value === 'none' && wavRecorder.getStatus() === 'recording') {
      await wavRecorder.pause();
    }
    client.updateSession({
      turn_detection: value === 'none' ? null : { type: 'server_vad' },
    });
    if (value === 'server_vad' && client.isConnected()) {
      await wavRecorder.record((data) => client.appendInputAudio(data.mono));
    }
    setCanPushToTalk(value === 'none');
  };
  useEffect(() => {
    //temperatureRef.current = {
      //value: inputData.What, // NEW: Sync the "What" input from `inputData`
      //units: inputData.Where, // NEW: Sync the "Where" input from `inputData`
    //};

    //console.log(temperatureRef);
    whatRef.current = {
      value: inputData.What,
    }
    whereRef.current = {
      value: inputData.Where,
    }
    howRef.current = {
      value: inputData.How,
    }
    whenRef.current = {
      value: inputData.when,
    }
    howmanyRef.current = {
      value: inputData.howmany,
    }
  }, [inputData.What, inputData.Where, inputData.How, inputData.when, inputData.howmany]); // NEW: Dependencies to update ref whenever these inputs change


  useEffect(() => {
    if (eventsScrollRef.current) {
      const eventsEl = eventsScrollRef.current;
      const scrollHeight = eventsEl.scrollHeight;
      if (scrollHeight !== eventsScrollHeightRef.current) {
        eventsEl.scrollTop = scrollHeight;
        eventsScrollHeightRef.current = scrollHeight;
      }
    }
  }, [realtimeEvents]);

  useEffect(() => {
    const conversationEls = [].slice.call(
      document.body.querySelectorAll('[data-conversation-content]')
    );
    for (const el of conversationEls) {
      const conversationEl = el as HTMLDivElement;
      conversationEl.scrollTop = conversationEl.scrollHeight;
    }
  }, [items]);

  useEffect(() => {
    let isLoaded = true;

    const wavRecorder = wavRecorderRef.current;
    const clientCanvas = clientCanvasRef.current;
    let clientCtx: CanvasRenderingContext2D | null = null;

    const wavStreamPlayer = wavStreamPlayerRef.current;
    const serverCanvas = serverCanvasRef.current;
    let serverCtx: CanvasRenderingContext2D | null = null;

    const render = () => {
      if (isLoaded) {
        if (clientCanvas) {
          if (!clientCanvas.width || !clientCanvas.height) {
            clientCanvas.width = clientCanvas.offsetWidth;
            clientCanvas.height = clientCanvas.offsetHeight;
          }
          clientCtx = clientCtx || clientCanvas.getContext('2d');
          if (clientCtx) {
            clientCtx.clearRect(0, 0, clientCanvas.width, clientCanvas.height);
            const result = wavRecorder.recording
              ? wavRecorder.getFrequencies('voice')
              : { values: new Float32Array([0]) };
            WavRenderer.drawBars(
              clientCanvas,
              clientCtx,
              result.values,
              '#0099ff',
              10,
              0,
              8
            );
          }
        }
        if (serverCanvas) {
          if (!serverCanvas.width || !serverCanvas.height) {
            serverCanvas.width = serverCanvas.offsetWidth;
            serverCanvas.height = serverCanvas.offsetHeight;
          }
          serverCtx = serverCtx || serverCanvas.getContext('2d');
          if (serverCtx) {
            serverCtx.clearRect(0, 0, serverCanvas.width, serverCanvas.height);
            const result = wavStreamPlayer.analyser
              ? wavStreamPlayer.getFrequencies('voice')
              : { values: new Float32Array([0]) };
            WavRenderer.drawBars(
              serverCanvas,
              serverCtx,
              result.values,
              '#009900',
              10,
              0,
              8
            );
          }
        }
        window.requestAnimationFrame(render);
      }
    };
    render();

    return () => {
      isLoaded = false;
    };
  }, []);

  useEffect(() => {
    const wavStreamPlayer = wavStreamPlayerRef.current;
    const client = clientRef.current;
  
    client.updateSession({ instructions: instructions });
    client.updateSession({ input_audio_transcription: { model: 'whisper-1' } });

    client.addTool(
      {
        name: 'set_memory',
        description: 'Saves important data about the user into memory.',
        parameters: {
          type: 'object',
          properties: {
            key: {
              type: 'string',
              description:
                'The key of the memory value. Always use lowercase and underscores, no other characters.',
            },
            value: {
              type: 'string',
              description: 'Value can be anything represented as a string',
            },
          },
          required: ['key', 'value'],
        },
      },
      async ({ key, value }: { [key: string]: any }) => {
        setMemoryKv((memoryKv) => {
          const newKv = { ...memoryKv };
          newKv[key] = value;
          return newKv;
        });
        return { ok: true };
      }
    );
    client.addTool(
      {
        name: 'get_weather',
        description:
          'Retrieves the weather for a given lat, lng coordinate pair. Specify a label for the location.',
        parameters: {
          type: 'object',
          properties: {
            lat: {
              type: 'number',
              description: 'Latitude',
            },
            lng: {
              type: 'number',
              description: 'Longitude',
            },
            location: {
              type: 'string',
              description: 'Name of the location',
            },
          },
          required: ['lat', 'lng', 'location'],
        },
      },
      async ({ lat, lng, location}: { [key: string]: any }) => {
        setMarker({ lat, lng, location });
        setCoords({ lat, lng, location });
        const result = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,wind_speed_10m`
        );
        const json = await result.json();
        
        const wind_speed = {
          value: json.current.wind_speed_10m as number,
          units: json.current_units.wind_speed_10m as string,
        };
        const latestTemperature = temperatureRef.current; // NEW: Access the latest value of the temperature
        console.log('Latest temperature:', latestTemperature); // NEW: Log the latest temperature for debugging

        const temperature = latestTemperature || { value: 0, units: '' }; // NEW: Use the latest temperature or a fallback value
        setMarker({ lat, lng, location, temperature, wind_speed }); // NEW: Include the latest temperature in the marker
        return temperature;
      }
    );
    client.addTool(
      {
        name: 'Answer',
        description:
          'Retrieves the info from student in the input box that the user inserts always mention the user his answer.',
        parameters: {
          type: 'object',
          properties: {
            what: {
              type: 'string',
              description: 'answer to the question input of "what" mention it to the user wrong be sure to say: "what did the people complain about?"',
            },
            where: {
              type: 'string',
              description: 'answer to the question input of "where" mention it to the user wrong be sure to say: "Where at the what, what quality of the what is not being accomplished?"',
            },
            how: {
              type: 'string',
              description: 'user answer to the question input of "how" mention it to the user if wrong be sure to say "How was it detected, be precise, how many complained"' ,
            },
            when: {
              type: 'string',
              description: 'answer to the question input of "when" mention it to the user wrong be sure to say: "When do you have reoccurrence, minutes? After set up?"',
            },
            howmany: {
              type: 'string',
              description: 'answer to the question input of "howmany" mention it to the user wrong be sure to say: "Does it have a pattern does is happen ever time?"',
            },
            
          },
          required: [],
        },
      },
      async ({ what, where, how, when, howmany }: { [key: string]: any }) => {
       
        const whatValue = whatRef.current;
        const whereValue = whereRef.current;
        const howValue = howRef.current;
        const whenValue = whenRef.current;
        const howmanyValue = howmanyRef.current;
        return [whatValue, whereValue, howValue, whenValue, howmanyValue];
      }
    );
    client.on('realtime.event', (realtimeEvent: RealtimeEvent) => {
      setRealtimeEvents((realtimeEvents) => {
        const lastEvent = realtimeEvents[realtimeEvents.length - 1];
        if (lastEvent?.event.type === realtimeEvent.event.type) {
          lastEvent.count = (lastEvent.count || 0) + 1;
          return realtimeEvents.slice(0, -1).concat(lastEvent);
        } else {
          return realtimeEvents.concat(realtimeEvent);
        }
      });
    });
    client.on('error', (event: any) => console.error(event));
    client.on('conversation.interrupted', async () => {
      const trackSampleOffset = await wavStreamPlayer.interrupt();
      if (trackSampleOffset?.trackId) {
        const { trackId, offset } = trackSampleOffset;
        await client.cancelResponse(trackId, offset);
      }
    });
    client.on('conversation.updated', async ({ item, delta }: any) => {
      const items = client.conversation.getItems();
      if (delta?.audio) {
        wavStreamPlayer.add16BitPCM(delta.audio, item.id);
      }
      if (item.status === 'completed' && item.formatted.audio?.length) {
        const wavFile = await WavRecorder.decode(
          item.formatted.audio,
          24000,
          24000
        );
        item.formatted.file = wavFile;
      }
      setItems(items);
    });

    setItems(client.conversation.getItems());

    return () => {
      client.reset();
    };
  }, []);

  return (
    <div data-component="ConsolePage">
      <div className="content-top">
        <div className="content-title">
         <img src="/BSH.svg" />
          <span>A3I realtime console</span>
        </div>
        <div className="content-api-key">
          {!LOCAL_RELAY_SERVER_URL && (
            <Button
              icon={Edit}
              iconPosition="end"
              buttonStyle="flush"
              label={`api key: ${apiKey.slice(0, 3)}...`}
              onClick={() => resetAPIKey()}
            />
          )}
        </div>
      </div>
      <div className="content-main">
        <div className="content-logs">
          
          <div className="form-grid" style={{ width: '100%', overflowY: 'auto', maxHeight: '500px' }}>
            {/* 1)Perception  of presenting problem */}
            <div className="form-section">
              <h3>1)Perception  of presenting problem</h3>
              <input type="text" placeholder="Problem description" />
              <div className="form-row">
                <h2>&nbsp;&nbsp;What&nbsp;&nbsp;&nbsp; </h2>
                <input type="text" name="What" value={inputData.What} onChange={handleInputChange} placeholder="  Is" />
                <input type="text" placeholder="  Is not" />
              </div>
              <div className="form-row">
                <h2>&nbsp;&nbsp;Where&nbsp;&nbsp;</h2>
                <input type="text" name="Where" value={inputData.Where} onChange={handleInputChange} placeholder="  Is" />
                <input type="text" placeholder="  Is not" />
              </div>
              <div className="form-row">
              <h2>&nbsp;&nbsp;&nbsp;How&nbsp;&nbsp;&nbsp; </h2>
                <input type="text" name="How" value={inputData.How} onChange={handleInputChange} placeholder="  Is" />
                <input type="text" placeholder="  Is not" />
              </div>
              <div className="form-row">
                <h2>&nbsp;&nbsp;When&nbsp;&nbsp;&nbsp; </h2>
                <input type="text" name="when" value={inputData.when} onChange={handleInputChange} placeholder="  Is" />
                <input type="text" placeholder="  Is not" />
              </div>
              <div className="form-row">
                <h2>How many&nbsp; </h2>
                <input type="text" name="howmany" value={inputData.howmany} onChange={handleInputChange} placeholder="  Is" />
                <input type="text" placeholder="  Is not" />
              </div>
            </div>
            {/* Empieza 2)Problem description */}
            <div className="form-section">
              <h3>2)Problem description</h3>
              <div className="form-row">
                <h2>&nbsp;Aproach&nbsp; </h2>
                <input type="text" placeholder="  Object" />
                <input type="text" placeholder="  Defect on object" />
              </div>
              <div className="form-row">
                <h2>&nbsp;System&nbsp;&nbsp;</h2>
                <input type="text" placeholder="  Object" />
                <input type="text" placeholder="  Defect on object" />
              </div>
              <div className="form-row">
              <h2>&nbsp;Process&nbsp; </h2>
              <input type="text" placeholder="  Object" />
              <input type="text" placeholder="  Defect on object" />
              </div>
              <div className="form-row">
                <h2>&nbsp;Product&nbsp; </h2>
                <input type="text" placeholder="  Object" />
                <input type="text" placeholder="  Defect on object" />
              </div>
              <div className="form-row">
                <h2>Component</h2>
                <input type="text" placeholder="  Object" />
                <input type="text" placeholder="  Defect on object" />
              </div>
              <div className="form-row">
                <h2>&nbsp;&nbsp;&nbsp;SMO&nbsp;&nbsp;&nbsp; </h2>
                <input type="text" placeholder="  Object" />
                <input type="text" placeholder="  Defect on object" />
              </div>
            </div>
            {/* Empieza 4)Ishikawa */}
            <div className="form-section">
              <h3>4) Cause and effect analysis</h3>
              <input type="text" placeholder="Samallest possible object" />
              <div className="form-row">
                <h2>Fishbone diagram</h2>
              </div>
              <div className="form-row">
                <input type="text" placeholder="Human" />
                <input type="text" placeholder="Machine" />
                <input type="text" placeholder="Method" />
                <input type="text" placeholder="Material" />
                <input type="text" placeholder="Enviroment" />
              </div>
              <div className="form-row">
                <input type="text" placeholder="Human" />
                <input type="text" placeholder="Machine" />
                <input type="text" placeholder="Method" />
                <input type="text" placeholder="Material" />
                <input type="text" placeholder="Enviroment" />
              </div>
              <div className="form-row">
                <input type="text" placeholder="Human" />
                <input type="text" placeholder="Machine" />
                <input type="text" placeholder="Method" />
                <input type="text" placeholder="Material" />
                <input type="text" placeholder="Enviroment" />
              </div>
            </div>
             {/* Empieza 4)Ishikawa */}
             <div className="form-section">
              <h3>4.1) Root cause analysis</h3>
              
              <div className="form-row">
                <h2>Rood cause 1</h2>
                <input type="text" placeholder="Why" />
                <input type="text" placeholder="Why" />
                <input type="text" placeholder="Why" />
                <input type="text" placeholder="Why" />
                <input type="text" placeholder="Why" />
              </div>
              <div className="form-row">
              <h2>Rood cause 2</h2>
              <input type="text" placeholder="Why" />
                <input type="text" placeholder="Why" />
                <input type="text" placeholder="Why" />
                <input type="text" placeholder="Why" />
                <input type="text" placeholder="Why" />
              </div>
              <div className="form-row">
              <h2>Rood cause 3</h2>
              <input type="text" placeholder="Why" />
                <input type="text" placeholder="Why" />
                <input type="text" placeholder="Why" />
                <input type="text" placeholder="Why" />
                <input type="text" placeholder="Why" />
              </div>
            </div>
            {/* Empieza 4)Ishikawa */}
            <div className="form-section">
              <h3>2) Problem description</h3>
              <textarea placeholder="Grafischer Verlauf des Problems" />
              <div className="form-row">
                <input type="text" placeholder="Ansatz" />
                <input type="text" placeholder="Objekt" />
                <input type="text" placeholder="Defekt am Objekt" />
                
              </div>
            </div>
          </div>
           {/* Empieza conversacion */}
          <div className="content-block conversation" style={{ flexGrow: 1, overflowY: 'auto' }}>
            <div className="content-block-title">conversation</div>
            <div className="content-block-body" data-conversation-content>
              {!items.length && `awaiting connection...`}
              {items.map((conversationItem, i) => {
                return (
                  <div className="conversation-item" key={conversationItem.id}>
                    <div className={`speaker ${conversationItem.role || ''}`}>
                      <div>
                        {(
                          conversationItem.role || conversationItem.type
                        ).replaceAll('_', ' ')}
                      </div>
                      <div
                        className="close"
                        onClick={() =>
                          deleteConversationItem(conversationItem.id)
                        }
                      >
                        <X />
                      </div>
                    </div>
                    <div className={`speaker-content`}>
                      {conversationItem.type === 'function_call_output' && (
                        <div>{conversationItem.formatted.output}</div>
                      )}
                      {!!conversationItem.formatted.tool && (
                        <div>
                          {conversationItem.formatted.tool.name}(
                          {conversationItem.formatted.tool.arguments})
                        </div>
                      )}
                      {!conversationItem.formatted.tool &&
                        conversationItem.role === 'user' && (
                          <div>
                            {conversationItem.formatted.transcript ||
                              (conversationItem.formatted.audio?.length
                                ? '(awaiting transcript)'
                                : conversationItem.formatted.text ||
                                  '(item sent)')}
                          </div>
                        )}
                      {!conversationItem.formatted.tool &&
                        conversationItem.role === 'assistant' && (
                          <div>
                            {conversationItem.formatted.transcript ||
                              conversationItem.formatted.text ||
                              '(truncated)'}
                          </div>
                        )}
                      {conversationItem.formatted.file && (
                        <audio
                          src={conversationItem.formatted.file.url}
                          controls
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="content-actions">
            <Toggle
              defaultValue={false}
              labels={['manual', 'vad']}
              values={['none', 'server_vad']}
              onChange={(_, value) => changeTurnEndType(value)}
            />
            <div className="spacer" />
            {isConnected && canPushToTalk && (
              <Button
                label={isRecording ? 'release to send' : 'push to talk'}
                buttonStyle={isRecording ? 'alert' : 'regular'}
                disabled={!isConnected || !canPushToTalk}
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
              />
            )}
            <div className="spacer" />
            <Button
              label={isConnected ? 'disconnect' : 'connect'}
              iconPosition={isConnected ? 'end' : 'start'}
              icon={isConnected ? X : Zap}
              buttonStyle={isConnected ? 'regular' : 'action'}
              onClick={
                isConnected ? disconnectConversation : connectConversation
              }
            />
          </div>
        </div>
        <div className="content-right">
          <div className="content-block kv">
            <div className="content-block-title">set_memory()</div>
            <div className="content-block-body content-kv">
              {JSON.stringify(memoryKv, null, 2)}
            </div>
          </div>
          <div className="content-block kv">
            <div className="content-block-title">Answers()</div>
            <div className="content-block-body content-kv">
              {JSON.stringify(inputData, null, 2)}
            </div>
          </div>
          <div className="content-block events">
            <div className="visualization">
              <div className="visualization-entry client">
                <canvas ref={clientCanvasRef} />
              </div>
              <div className="visualization-entry server">
                <canvas ref={serverCanvasRef} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
