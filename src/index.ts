import express from 'express'
import * as path from 'path';
import * as grpc from '@grpc/grpc-js';
import { connect, Contract, Gateway, Identity, Network, Signer, signers } from '@hyperledger/fabric-gateway';
import { promises as fs } from 'fs';
import * as crypto from 'crypto';

const app = express()

const channelName = envOrDefault('CHANNEL_NAME', 'prueba');
const chaincodeName = envOrDefault('CHAINCODE_NAME', 'auctioncontract');
const mspId = envOrDefault('MSP_ID', 'Org2MSP');

// Path to crypto materials.
const cryptoPath = envOrDefault('CRYPTO_PATH', path.resolve(__dirname, '..', '..', '..', 'test-network', 'organizations', 'peerOrganizations', 'org2.example.com'));

// Path to user private key directory.
const keyDirectoryPath = envOrDefault('KEY_DIRECTORY_PATH', path.resolve(cryptoPath, 'users', 'User1@org2.example.com', 'msp', 'keystore'));

// Path to user certificate.
const certPath = envOrDefault('CERT_PATH', path.resolve(cryptoPath, 'users', 'User1@org2.example.com', 'msp', 'signcerts', 'User1@org2.example.com-cert.pem'));

// Path to peer tls certificate.
const tlsCertPath = envOrDefault('TLS_CERT_PATH', path.resolve(cryptoPath, 'peers', 'peer0.org2.example.com', 'tls', 'ca.crt'));

// Gateway peer endpoint.
const peerEndpoint = envOrDefault('PEER_ENDPOINT', 'localhost:9051');

// Gateway peer SSL host name override.
const peerHostAlias = envOrDefault('PEER_HOST_ALIAS', 'peer0.org2.example.com');

const utf8Decoder = new TextDecoder();
// const assetId = `asset${Date.now()}`;

let client:grpc.Client;
let gateway:Gateway;
let network: Network;
let contract: Contract ;



app.use(express.json())

const PORT = 5000

app.get('/list-auctions',async (_, res) => {
    console.log('Probando interacción con blockchain')
    await setConnection();
    var data = await getAllAuctions();
    
    res.send(data) 
})

app.post('/create-auction',async (req, res) => {
    console.log('Creando subasta en la blockchain')
    console.log(req.body);
    var message = "";
    try {
        await setConnection();
        await createAuction(req.body.auctionCode, req.body.entityCode,req.body.owner,req.body.datetimeCreation, req.body.item);
        message = "Creado OKi" 
    } catch (error) {
        console.log(error);
        console.log("error al crear");
        closeConnection();
        message = "Error al crear"
        res.statusCode = 409;
    }
    closeConnection();
    
    res.send({"message":message}) 
    
})

app.post('/create-bid',async (req, res) => {
    console.log('Creando oferta en la blockchain')
    console.log(req.body);
    var message = "";
    try {
        await setConnection();
        await createBid(req.body.codigoSubasta, req.body.codigoPostor, req.body.codigoBienServicio,req.body.primeraOferta,req.body.fechaHoraPrimeraOferta,req.body.owner);
        message = "Creado OKi" 
    } catch (error) {
        console.log(error);
        console.log("error al crear");
        closeConnection();
        message = "Error al crear"
        res.statusCode = 409;
    }
 
    
    res.send({"message":message}) 
    
})

app.listen(PORT, () => {
    console.log('Server running on port ' + PORT)
})

async function setConnection(){
    await displayInputParameters();

    // The gRPC client connection should be shared by all Gateway connections to this endpoint.
    client = await newGrpcConnection();

    gateway = connect({
        client,
        identity: await newIdentity(),
        signer: await newSigner(),
        // Default timeouts for different gRPC calls
        evaluateOptions: () => {
            return { deadline: Date.now() + 5000 }; // 5 seconds
        },
        endorseOptions: () => {
            return { deadline: Date.now() + 15000 }; // 15 seconds
        },
        submitOptions: () => {
            return { deadline: Date.now() + 5000 }; // 5 seconds
        },
        commitStatusOptions: () => {
            return { deadline: Date.now() + 60000 }; // 1 minute
        },
    });
    try {
        // Get a network instance representing the channel where the smart contract is deployed.
        network = gateway.getNetwork(channelName);

        // Get the smart contract from the network.
        contract = network.getContract(chaincodeName);

  
        return [network,contract]
    } finally {
        console.log("Finalizo apertura de conexion");
        
    }
}

function closeConnection(){
    gateway.close();
    client.close();
}



async function getAllAuctions(): Promise<Object> {
    console.log('\n--> Evaluate Transaction: GetAllauctions, function returns all the current auctions on the ledger');
    await setConnection();
    const resultBytes = await contract.evaluateTransaction('GetAllAuctions');
    closeConnection()
    var resultJson = JSON.parse(utf8Decoder.decode(resultBytes));
    resultJson=  resultJson.filter((obj: { Items: Array<Object>; }) => obj.Items !== undefined )

    
    return resultJson;
    
}


async function createAuction (codigoSubasta: string, codigoEntidad:string,propietario:string, fechaHoraCreacion:string, item:object){
    
    console.log("Vamos a crear");
    
    await contract.submitTransaction(
        'CreateAuction',
        codigoSubasta,
        codigoEntidad,
        fechaHoraCreacion,
        propietario,
        JSON.stringify(item)
    );
    console.log("Se creó correctamente en blockchain");


}

async function createBid (codigoSubasta: string, codigoPostor:string,codigoBienServicio:string,primeraOferta:string , fechaHoraPrimeraOferta:string,propietario:string,){
    
    console.log("Vamos a crear");
    console.log(primeraOferta);
    
    await contract.submitTransaction(
        'CreateBid',
        codigoSubasta,
        codigoPostor,
        codigoBienServicio,
        primeraOferta,
        fechaHoraPrimeraOferta,
        propietario,
    );
    console.log("Se creó correctamente en blockchain");


}


async function newGrpcConnection(): Promise<grpc.Client> {

    const tlsRootCert = await fs.readFile(tlsCertPath);
    const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);
    return new grpc.Client(peerEndpoint, tlsCredentials, {
        'grpc.ssl_target_name_override': peerHostAlias,
    });
}

async function displayInputParameters(): Promise<void> {
    console.log(`channelName:       ${channelName}`);
    console.log(`chaincodeName:     ${chaincodeName}`);
    console.log(`mspId:             ${mspId}`);
    console.log(`cryptoPath:        ${cryptoPath}`);
    console.log(`keyDirectoryPath:  ${keyDirectoryPath}`);
    console.log(`certPath:          ${certPath}`);
    console.log(`tlsCertPath:       ${tlsCertPath}`);
    console.log(`peerEndpoint:      ${peerEndpoint}`);
    console.log(`peerHostAlias:     ${peerHostAlias}`);
}

function envOrDefault(key: string, defaultValue: string): string {
    return process.env[key] || defaultValue;
}

async function newIdentity(): Promise<Identity> {
    const credentials = await fs.readFile(certPath);
    return { mspId, credentials };
}

async function newSigner(): Promise<Signer> {
    const files = await fs.readdir(keyDirectoryPath);
    const keyPath = path.resolve(keyDirectoryPath, files[0]);
    const privateKeyPem = await fs.readFile(keyPath);
    const privateKey = crypto.createPrivateKey(privateKeyPem);
    return signers.newPrivateKeySigner(privateKey);
}