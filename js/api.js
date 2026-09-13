// API 통신
const API_BASE='https://q2qzdad9pk.execute-api.ap-northeast-2.amazonaws.com';

const API={
  async save(nickname,pin,result){
    const res=await fetch(API_BASE+'/results',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({nickname,pin,result})
    });
    return res.json();
  },
  async list(nickname,pin){
    const res=await fetch(API_BASE+'/results/list',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({nickname,pin})
    });
    return res.json();
  },
  async detail(nickname,pin,sk){
    const res=await fetch(API_BASE+'/results/detail',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({nickname,pin,sk})
    });
    return res.json();
  }
};
