class Service {
  log(msg: any[] | any) {
    if (Array.isArray(msg)) {
      msg.forEach((m) => console.log(m));
    } else {
      console.log(msg);
    }
  }

  init_banner(msg: string = "Docuementos vaticanos") {
    console.log("+++++++++++++++++++++++++++++++++++++++++++++++");
    console.log(msg);
    console.log("+++++++++++++++++++++++++++++++++++++++++++++++");
    
  }
}

const GeneralService = new Service();
export { GeneralService };
