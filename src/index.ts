import express from 'express'
import * as path from 'path';
import * as grpc from '@grpc/grpc-js';
import { connect, Contract, Gateway, Identity, Network, Signer, signers } from '@hyperledger/fabric-gateway';
import { promises as fs } from 'fs';
import * as crypto from 'crypto';
import * as fs2 from 'fs';

const app = express()

const channelName = envOrDefault('CHANNEL_NAME', 'gobiernoperu');
const chaincodeName = envOrDefault('CHAINCODE_NAME', 'reverseauction');
const mspId = envOrDefault('MSP_ID', 'Org2MSP');
// const mspId = envOrDefault('MSP_ID', 'Org3MSP');

// Path to crypto materials.
const cryptoPath = envOrDefault('CRYPTO_PATH', path.resolve(__dirname, '..', '..', '..', 'test-network', 'organizations', 'peerOrganizations', 'org2.example.com'));
// const cryptoPath = envOrDefault('CRYPTO_PATH', path.resolve(__dirname, '..', '..', '..', 'test-network', 'organizations', 'peerOrganizations', 'org3.example.com'));

// Path to user private key directory.
const keyDirectoryPath = envOrDefault('KEY_DIRECTORY_PATH', path.resolve(cryptoPath, 'users', 'User1@org2.example.com', 'msp', 'keystore'));
// const keyDirectoryPath = envOrDefault('KEY_DIRECTORY_PATH', path.resolve(cryptoPath, 'users', 'User1@org3.example.com', 'msp', 'keystore'));

// Path to user certificate.
const certPath = envOrDefault('CERT_PATH', path.resolve(cryptoPath, 'users', 'User1@org2.example.com', 'msp', 'signcerts', 'User1@org2.example.com-cert.pem'));
// const certPath = envOrDefault('CERT_PATH', path.resolve(cryptoPath, 'users', 'User1@org3.example.com', 'msp', 'signcerts', 'User1@org3.example.com-cert.pem'));

// Path to peer tls certificate.
const tlsCertPath = envOrDefault('TLS_CERT_PATH', path.resolve(cryptoPath, 'peers', 'peer0.org2.example.com', 'tls', 'ca.crt'));
// const tlsCertPath = envOrDefault('TLS_CERT_PATH', path.resolve(cryptoPath, 'peers', 'peer0.org3.example.com', 'tls', 'ca.crt'));

const aesKeyPath = path.resolve(cryptoPath, 'peers', 'peer0.org2.example.com', 'aes', 'aes.key');


// Gateway peer endpoint.
const peerEndpoint = envOrDefault('PEER_ENDPOINT', 'localhost:9051');
// const peerEndpoint = envOrDefault('PEER_ENDPOINT', 'localhost:11051');

// Gateway peer SSL host name override.
const peerHostAlias = envOrDefault('PEER_HOST_ALIAS', 'peer0.org2.example.com');
// const peerHostAlias = envOrDefault('PEER_HOST_ALIAS', 'peer0.org3.example.com');

const utf8Decoder = new TextDecoder();

let client:grpc.Client;
let gateway:Gateway;
let network: Network;
let contract: Contract ;



app.use(express.json())

const PORT = 5000

 interface ISpecialInfo {
    State: Number;
    CurrentBid: Number;
    LastBid: Number;
    IsOpen: boolean;
 
}

app.post('/register-participation/:auctionCode/:bidderCode',async (req, res) => {
    
    var message = ""
    try {
        await setConnection();
        var auctionBidder = {"CodigoPostor": req.params.bidderCode,"FechaHoraRegistroPartic":req.body.datetimeReg};
        await registerParticipation(req.params.auctionCode,auctionBidder);
        message = "Registro de partcipación OKi" 
       
    } catch (error) {
        message="Error al intentar registrar participación"
        
    }
    closeConnection();
    res.send({"message":message})
})


app.post('/register-first-bid/:auctionCode/:bidderCode/:goodServiceCode',async (req, res) => {

    var message = ""
    try {
        await setConnection();
        var itemBidder = {"CodigoPostor": req.params.bidderCode,"PrimeraOferta":{"Price":req.body.firstBid,"DatetimeReg":req.body.datetimeReg}};
        await registerFirstBid(req.params.auctionCode,req.params.goodServiceCode,itemBidder);
        message = "Registro de primera oferta OKi" 
       
    } catch (error) {
        message="Error al intentar registrar primera oferta"
        
    }
    closeConnection();
    res.send({"message":message})
})

app.post('/register-price-bid/:auctionCode/:bidderCode/:goodServiceCode',async (req, res) => {

    var message = ""
    try {
        await setConnection();
        var bid = {"Price":req.body.newBid,"DatetimeReg":req.body.datetimeReg};
        await registerPriceBid(req.params.auctionCode,req.params.goodServiceCode,req.params.bidderCode,bid);
        message = "Registro de puja OKi" 
       
    } catch (error) {
        message="Error al intentar registrar puja"
        
    }
    closeConnection();
    res.send({"message":message})
})

app.post('/register-buena-pro/:auctionCode/:goodServiceCode',async (req, res) => {

    var message = ""
    try {
        console.log("Se va a registrar buena pro");
        
        await setConnection();
        await registerBuenaPro(req.params.auctionCode,req.params.goodServiceCode,req.body.firstBidderEntityCode,req.body.secondBidderEntityCode, req.body.datetimeReg);
        message = "Registro de buena pro OKi" 
       
    } catch (error) {
        message="Error al intentar registrar buena pro oferta"
        
    }
    closeConnection();
    res.send({"message":message})
})


app.post('/finish-phase/:code/:phaseCod',async (req, res) => {
    console.log(req.params.code)
    var message = ""
    try {
        await setConnection();
        await finishPhase(req.params.code,req.params.phaseCod,req.body.datetimeFinish);
        message = "Cerrada la etapa OKi" 
        
       
    } catch (error) {
        message="Error al intentar cerrar fase"
        
    }
    closeConnection();
    res.send({"message":message})
})

app.get('/get-auction/:code',async (req, res) => {
    console.log(req.params.code)
    await setConnection();
    var data = await getAuction(req.params.code);
    closeConnection();
    res.send(data) 
})

app.get('/get-auction-decrypt/:code',async (req, res) => {
    var data = null
    try {
        console.log(req.params.code)
        await setConnection();
        data = await getAuctionDecrypt(req.params.code);
        
    } catch (error) {
        console.log(error);
        console.log("Error al obtener detalle de subasta en modo encriptado");
        res.statusCode = 403;
    }
    closeConnection();
    res.send(data) 
})



app.get('/get-special-info-auction/:auctionCode/:bidderCode/:goodServiceCode',async (req, res) => {
    console.log(req.params.auctionCode)
    console.log(req.params.bidderCode)
    console.log(req.params.goodServiceCode)
    await setConnection();
    var data = await getSpecialInfoAuction(req.params.auctionCode,req.params.goodServiceCode,req.params.bidderCode);
    closeConnection();
    res.send(data) 
})

app.get('/get-buenapro-info-auction/:auctionCode',async (req, res) => {
    await setConnection();
    var data = await getBuenaProInfoAuction(req.params.auctionCode);
    closeConnection();
    res.send(data) 
})

app.get('/list-auctions',async (_, res) => {
    console.log('Probando interacción con blockchain')
    await setConnection();
    var data = await getAllAuctions();
    closeConnection();
    
    res.send(data) 
})

app.get('/list-auctions-decrypt',async (_, res) => {

    var data = null
    try {
        await setConnection();
        data = await  getAllAuctionsDecrypt();
        
    } catch (error) {
        console.log(error);
        console.log("Error al obtener lista de subastas en modo encriptado");
        res.statusCode = 403;
    }
    closeConnection();
    res.send(data) 

})

app.post('/create-auction',async (req, res) => {
    console.log('Creando subasta en la blockchain')
    console.log(req.body);
    var message = "";
    try {
        await setConnection();

        var convocatoriaPhase = {"DatetimeInit":req.body.datetimeInitConv,"DatetimeEnd":req.body.datetimeEndConv,"DatetimeEndStamp":""} 
        var primeraOfertaPhase = {"DatetimeInit":req.body.datetimeInitFirstBid,"DatetimeEnd":req.body.datetimeEndFirstBid,"DatetimeEndStamp":""} 
        var pujaPhase = {"DatetimeInit":req.body.datetimeInitPriceBid,"DatetimeEnd":req.body.datetimeEndPriceBid,"DatetimeEndStamp":""} 
        var buenaProPhase = {"DatetimeInit":req.body.datetimeInitBuenaPro,"DatetimeEnd":req.body.datetimeEndBuenaPro,"DatetimeEndStamp":""} 
        console.log(convocatoriaPhase);
        console.log(primeraOfertaPhase);
        console.log(pujaPhase);
        console.log(buenaProPhase);
        console.log("----------------------");
        
        
        
        
        
        await createAuction(req.body.auctionCode, req.body.entityCode,req.body.owner,req.body.datetimeCreation,req.body.referenceValue, req.body.item,
            convocatoriaPhase,primeraOfertaPhase,pujaPhase,buenaProPhase);
        message = "Creado OKi" 
    } catch (error) {
        console.log(error);
        console.log("error al crear");
        message = "Error al crear"
        res.statusCode = 409;
    }
    closeConnection();
    
    res.send({"message":message}) 
    
})

app.post('/create-auction-encrypt',async (req, res) => {
    console.log('Creando subasta en la blockchain en modo encriptado')
    console.log(req.body);
    var message = "";
    try {
        await setConnection();

        var convocatoriaPhase = {"DatetimeInit":req.body.datetimeInitConv,"DatetimeEnd":req.body.datetimeEndConv,"DatetimeEndStamp":""} 
        var primeraOfertaPhase = {"DatetimeInit":req.body.datetimeInitFirstBid,"DatetimeEnd":req.body.datetimeEndFirstBid,"DatetimeEndStamp":""} 
        var pujaPhase = {"DatetimeInit":req.body.datetimeInitPriceBid,"DatetimeEnd":req.body.datetimeEndPriceBid,"DatetimeEndStamp":""} 
        var buenaProPhase = {"DatetimeInit":req.body.datetimeInitBuenaPro,"DatetimeEnd":req.body.datetimeEndBuenaPro,"DatetimeEndStamp":""} 
   
        
        await createAuctionEncrypt(req.body.auctionCode, req.body.entityCode,req.body.owner,req.body.datetimeCreation,req.body.referenceValue, req.body.item,
            convocatoriaPhase,primeraOfertaPhase,pujaPhase,buenaProPhase);
        message = "Creado OKi" 
    } catch (error) {
        console.log(error);
        console.log("error al crear");
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


app.post('/create-bid-encrypt',async (req, res) => {
    console.log('Creando oferta en la blockchain en modo encriptado')
    console.log(req.body);
    var message = "";
    try {
        await setConnection();
        await createBidEncrypt(req.body.codigoSubasta, req.body.codigoPostor, req.body.codigoBienServicio,req.body.primeraOferta,req.body.fechaHoraPrimeraOferta,req.body.owner);
        message = "Creado OKi" 
    } catch (error) {
        console.log(error);
        console.log("error al crear en modo encriptado");
        message = "Error al crear"
        res.statusCode = 409;
    }
 
    closeConnection();
    res.send({"message":message}) 
    
})

app.listen(PORT, () => {
    console.log('Server running on port ' + PORT)
})


function getAesContent(){

    return fs2.readFileSync(aesKeyPath, 'utf-8');


    
}

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

async function registerParticipation(auctionCode:string, auctionBidder :object) {
    await contract.submitTransaction(
        'RegisterParticipation',
        auctionCode,
        JSON.stringify(auctionBidder),
    );
    console.log("Se registró correctamente la participación en la blockchain");
    
}

async function registerFirstBid(auctionCode:string,goodServiceCode:string, itemBidder :object) {
    console.log("registerFirtBid");
    
    console.log(auctionCode);
    console.log(goodServiceCode);
    console.log(itemBidder);
    
    await contract.submitTransaction(
        'RegisterFirstBid',
        auctionCode,
        goodServiceCode,
        JSON.stringify(itemBidder),
    );
    console.log("Se registró correctamente la primera oferta en el item "+ goodServiceCode+ " en la blockchain");
    
}

async function registerPriceBid(auctionCode:string, goodServiceCode:string , bidderCode:string, bid: object){
  
    
    await contract.submitTransaction(
        'RegisterPriceBid',
        auctionCode,
        goodServiceCode,
        bidderCode,
        JSON.stringify(bid),
    );
    console.log("Se registró correctamente la puja en el item "+ goodServiceCode+ " por parte del postor "+ bidderCode+" en la blockchain");

}

async function registerBuenaPro(auctionCode:string, goodServiceCode:string , firstBidderEntityCode:string, secondBidderEntityCode: string, datetimeReg:string){
    console.log("Se va a enviar registro de buena pro a la blockchain");
    
    await contract.submitTransaction(
        'RegisterBuenaPro',
        auctionCode,
        goodServiceCode,
        firstBidderEntityCode,
        secondBidderEntityCode,
        datetimeReg
    );
    console.log("Se registró correctamente la buena pro para el bien o servicio"+ goodServiceCode+ " en la blockchain");

}


async function finishPhase(auctionCode:string, phaseCode:string, datetimeFinish :string) {
    await contract.submitTransaction(
        'FinishPhase',
        auctionCode,
        datetimeFinish,
        phaseCode,


    );
    console.log("Se creó correctamente en blockchain");
    
}   


async function getAuction(code: string): Promise<Object> {
    const resultBytes = await contract.evaluateTransaction('GetAuction',code);
    var resultJson = JSON.parse(utf8Decoder.decode(resultBytes));



    return resultJson;
}

async function getAuctionDecrypt(code: string): Promise<Object> {
    var aesKey = fs2.readFileSync(aesKeyPath, 'utf-8');
    const resultBytes = await contract.evaluateTransaction('GetAuctionDecrypt',aesKey, code);
    var resultJson = JSON.parse(utf8Decoder.decode(resultBytes));



    return resultJson;
}

async function getSpecialInfoAuction(auctionCode:string, goodServiceCode:string , bidderCode:string,): Promise<ISpecialInfo> {
    const resultBytes = await contract.evaluateTransaction('GetSpecialInfo',auctionCode,goodServiceCode,bidderCode);
    var resultJson = JSON.parse(utf8Decoder.decode(resultBytes));
    return resultJson;
}

async function getBuenaProInfoAuction(auctionCode:string): Promise<Object> {
    const resultBytes = await contract.evaluateTransaction('GetBuenaProInfo',auctionCode);
    if(resultBytes.length == 0) return []
    var resultJson = JSON.parse(utf8Decoder.decode(resultBytes));
    return resultJson;
}




async function getAllAuctions(): Promise<Object> {
    console.log('\n--> Evaluate Transaction: GetAllauctions, function returns all the current auctions on the ledger');
    const resultBytes = await contract.evaluateTransaction('GetAllAuctions');
    
    console.log(resultBytes == null  || resultBytes.length == 0);
    if(resultBytes.length == 0) return []
    var resultJson = JSON.parse(utf8Decoder.decode(resultBytes));
    resultJson=  resultJson.filter((obj: { Items: Array<Object>; }) => obj.Items !== undefined ) //esto podría salir
    return resultJson 
    
    
}


async function getAllAuctionsDecrypt(): Promise<Object> {
    console.log('\n--> Evaluate Transaction: GetAllauctions, function returns all the current auctions on the ledger');
    var aesKey = getAesContent();
    const resultBytes = await contract.evaluateTransaction('GetAllAuctionsDecrypt', aesKey);
    
    console.log(resultBytes == null  || resultBytes.length == 0);
    if(resultBytes.length == 0) return []
    var resultJson = JSON.parse(utf8Decoder.decode(resultBytes));
    resultJson=  resultJson.filter((obj: { Items: Array<Object>; }) => obj.Items !== undefined ) //esto podría salir
    return resultJson 

}

async function createAuction (codigoSubasta: string, codigoEntidad:string,propietario:string, fechaHoraCreacion:string, referenceValue: number, item:object,
    convocatoriaPhase:object, primeraOfertaPhase :object, pujaPhase :object, buenaProPhase :object){
    
    console.log("Vamos a crear");
    
    await contract.submitTransaction(
        'CreateAuction',
        codigoSubasta,
        codigoEntidad,
        fechaHoraCreacion,
        referenceValue.toString(),
        propietario,
        JSON.stringify(item),
        JSON.stringify(convocatoriaPhase),
        JSON.stringify(primeraOfertaPhase),
        JSON.stringify(pujaPhase),
        JSON.stringify(buenaProPhase),
    );
    console.log("Se creó correctamente en blockchain");


}

async function createAuctionEncrypt (codigoSubasta: string, codigoEntidad:string,propietario:string, fechaHoraCreacion:string, referenceValue: number, item:object,
    convocatoriaPhase:object, primeraOfertaPhase :object, pujaPhase :object, buenaProPhase :object){
    
    console.log("Vamos a crear");
    var aesKey = fs2.readFileSync(aesKeyPath, 'utf-8');
    // var aesKey = await fs.readFile(aesKeyPath);
    console.log(aesKey);
    await contract.submitTransaction(
        'CreateAuctionEncrypt',
        aesKey,
        codigoSubasta,
        codigoEntidad,
        fechaHoraCreacion,
        referenceValue.toString(),
        propietario,
        JSON.stringify(item),
        JSON.stringify(convocatoriaPhase),
        JSON.stringify(primeraOfertaPhase),
        JSON.stringify(pujaPhase),
        JSON.stringify(buenaProPhase),
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

async function createBidEncrypt (codigoSubasta: string, codigoPostor:string,codigoBienServicio:string,primeraOferta:string , fechaHoraPrimeraOferta:string,propietario:string,){
    
    var aesKey = getAesContent();
    console.log(primeraOferta);
    
    await contract.submitTransaction(
        'CreateBidEncrypt',
        aesKey,
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