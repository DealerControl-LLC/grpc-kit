const grpc = require("grpc");
const protoLoader = require("@grpc/proto-loader");

function getProtoFromPackageDefinition(packageDefinition, packageName) {
  const pathArr = packageName.split(".");
  return pathArr.reduce((obj, key) => (obj && obj[key] !== 'undefined') ? obj[key] : undefined, packageDefinition);
}

function createClient({ protoPath, packageName, serviceName, options }, address, creds=grpc.credentials.createInsecure()){
  const pkgDef = grpc.loadPackageDefinition(protoLoader.loadSync(protoPath, options));
  const proto = getProtoFromPackageDefinition(pkgDef, packageName);
  return new proto[serviceName](address, creds);
}

function createServer(){
  return new GrpcServer();
}

class GrpcServer {
  constructor(){
    this.server = new grpc.Server();
  }

  use({ protoPath, packageName, serviceName, routes, options, beforeCall, afterCall  }){
    const pkgDef = grpc.loadPackageDefinition(protoLoader.loadSync(protoPath, options));
    const proto = getProtoFromPackageDefinition(pkgDef, packageName);
    const router = Object.entries(routes).reduce((_router, [action, handler]) => {
			_router[action] = handleWhetherAsyncOrNot(handler, {beforeCall, afterCall, serviceName, action});
      return _router;
    }, {});
    this.server.addService(proto[serviceName].service, router);
    return this;
  }
  
  listen(address, creds=grpc.ServerCredentials.createInsecure()){
    this.server.bind(address, creds);
    this.server.start();
    return this;
  }

  close(force=false, cb){
    if(force){
      this.server.forceShutdown();
    }else{
      this.server.tryShutdown(cb);
    }
    return this;
  }
}

function handleWhetherAsyncOrNot(handler, {beforeCall, afterCall, serviceName, action}) {
  return async (call, callback) => {
    try{
      if(Array.isArray(beforeCall)){
        for(i = 0; i <= beforeCall.length; i++){
          let cb = beforeCall[i];
          if(typeof cb !== 'function'){
            continue;
          }
          await cb(call, serviceName, action);
        }
      } else
      if(typeof beforeCall === 'function'){
        await beforeCall(call, serviceName, action);
      }
      const response = await handler(call, callback);
      
      if(Array.isArray(afterCall)){
        for(i = 0; i <= afterCall.length; i++){
          let cb = afterCall[i];
          if(typeof cb !== 'function'){
            continue;
          }
          await cb(call, response, serviceName, action);
        }
      } else
      if(typeof afterCall === 'function'){
        await afterCall(call, response, serviceName, action);
      }

      return callback(null, response);
    } catch(err){
      return callback(err);
    }
  };
}

exports.createClient = createClient;
exports.createServer = createServer;
