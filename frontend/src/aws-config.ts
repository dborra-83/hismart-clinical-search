// Configuración de AWS Amplify
const config = {
  Auth: {
    region: 'us-east-1',
    userPoolId: 'us-east-1_m8sYNBNrl',
    userPoolWebClientId: '2jo6jlihm9jao8vn79c7hasp73',
    mandatorySignIn: true,
    authenticationFlowType: 'USER_SRP_AUTH'
  },
  API: {
    endpoints: [
      {
        name: 'HiSmartAPI',
        endpoint: 'https://jcbisv3pj8.execute-api.us-east-1.amazonaws.com/prod',
        region: 'us-east-1',
        custom_header: async () => {
          return {
            'Content-Type': 'application/json'
          };
        }
      }
    ]
  },
  Storage: {
    AWSS3: {
      bucket: 'hismart-clinical-data-520754296204-us-east-1',
      region: 'us-east-1'
    }
  }
};

export default config;