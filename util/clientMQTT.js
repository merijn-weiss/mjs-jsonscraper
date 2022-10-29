//* Module setup the MQTTClient */
'use strict'

// Setup the Client
const mqtt = require('mqtt');
const config = require('config');
const mqttConfig = config.get('mqtt');

function MQTTClient()
{
    console.log('*** setup MQTTClient ***')
    const clientId = `mqtt_${Math.random().toString(16).slice(3)}`;
    MQTTClient.client = mqtt.connect(mqttConfig.connectUrl, {
            clientId,
            clean: true,
            connectTimeout: 60000,
            reconnectPeriod: 1000
          });
    
    MQTTClient.client.on('connect', () => {
        console.log(`Connected: '${mqttConfig.connectUrl}'`);
    });    
}

const MQTTTopics = mqttConfig.topics;
function SubscribeOnTopics(mqttTopics)
{
    for(let mqttTopic of mqttTopics)
    {   
        let mqttTopicConfig = MQTTTopics[mqttTopic].topic;
        MQTTClient.client.subscribe([mqttTopicConfig], () => {
            console.log(`Subscribed: '${mqttTopic}' -> '${mqttTopicConfig}'`)
        });    
    }
}

module.exports = {
    MQTTClient,
    MQTTTopics,
    SubscribeOnTopics
};