'use strict';
require('dotenv').config();

const {ConvertRawJSON} = require('./transform.js');

//MQTT
const mqtt = require('./clientMQTT.js')
mqtt.MQTTClient();
mqtt.SubscribeOnTopics(['raw','converted']);

const topicRaw = mqtt.MQTTTopics.raw.topic;
const topicConverted = mqtt.MQTTTopics.converted.topic;

mqtt.MQTTClient.client.on('message', function(topic, message) {
    try{
        let jsonMessage = JSON.parse(message);
        let skipMQTT = true; 

        if(topic === topicRaw)
        {
            let convertedJSON = ConvertRawJSON(jsonMessage);

            if(skipMQTT) // store directly on ES, skipping one MQTT message
            {
                StoreJSONonElastic(convertedJSON);
            }
            else
            {
                if(mqtt.MQTTClient.client.connected)
                    mqtt.MQTTClient.client.publish(topicConverted, JSON.stringify(convertedJSON));
            }
        }
        else if(topic === topicConverted)
        {
            StoreJSONonElastic(jsonMessage);
        }
    }
    catch (err)
    {
        console.log("Error parsing JSON message:", err);
    }
  });

// ELASTIC
const {ElasticClient} = require('./clientES.js');
const elasticConfig = require('config').get('elastic');

ElasticClient.info()
  .then(response => console.log(response))
  .catch(error => console.error(error))

async function StoreJSONonElastic(convertedJSON)
{
    await ElasticClient.index({
        index: elasticConfig.index,
        body: convertedJSON
        });
}