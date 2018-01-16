import every from 'lodash/every'
import Immutable from 'immutable'
import { makeActions } from './'
import bip39 from 'bip39'
import {
  deriveMasterKeyPairFromSeedphrase,
  deriveGenericSigningKeyPair
} from 'lib/key-derivation'
import router from './router'
import StorageManager from 'lib/storage'

const NEXT_ROUTES = {
  '/registration': '/registration/write-phrase',
  '/registration/write-phrase': '/registration/entry-password'
}

export const actions = makeActions('registration', {
  goForward: {
    expectedParams: [],
    creator: () => {
      return (dispatch, getState) => {
        const state = getState()
        let nextURL = helpers._getNextURLfromState(state)
        dispatch(router.pushRoute(nextURL))
      }
    }
  },
  setMaskedImageUncovering: {
    expectedParams: ['value']
  },
  addEntropyFromDeltas: {
    expectedParams: ['x', 'y'],
    creator: (params) => {
      return (dispatch, getState, {backend, services}) => {
        if (getState().getIn(['registration', 'passphrase', 'phrase'])) {
          return
        }

        const entropy = services.entropy
        entropy.addFromDelta(params.x)
        entropy.addFromDelta(params.y)
        if (params.dz) {
          entropy.addFromDelta(params.z)
        }

        dispatch(actions.setEntropyStatus.buildAction({
          sufficientEntropy: entropy.getProgress() >= 1,
          progress: entropy.getProgress()
        }))

        if (entropy.isReady()) {
          const randomString = entropy.getRandomString(6)
          return dispatch(actions.submitEntropy(randomString))
        }
      }
    }
  },
  submitEntropy: {
    expectedParams: ['randomString'],
    creator: (randomString) => {
      return (dispatch, getState) => {
        const entropyState = getState().getIn([
          'registration',
          'passphrase',
          'sufficientEntropy'
        ])

        if (!entropyState) {
          throw new Error('Not enough entropy!')
        }
        dispatch(actions.generateSeedPhrase(randomString))
      }
    }
  },

  generateSeedPhrase: {
    expectedParams: ['randomString'],
    creator: (randomString) => {
      return (dispatch, getState) => {
        const mnemonic = bip39.entropyToMnemonic(randomString)
        dispatch(actions.setPassphrase({mnemonic}))
      }
    }
  },

  generateAndEncryptKeyPairs: {
    expectedParams: [],
    async: true,
    creator: () => {
      return (dispatch, getState, {services, backend}) => {
        const seedphrase = getState().getIn([
          'registration',
          'passphrase',
          'phrase'
        ])
        if (!seedphrase) {
          throw new Error('No seedphrase found.')
        }
        const masterKeyPair = deriveMasterKeyPairFromSeedphrase(seedphrase)
        console.log(masterKeyPair, 'master')
        dispatch(actions.encryptDataWithPasswordOnRegister(masterKeyPair)
        .then((result) => {
          console.log('inside master')
          StorageManager.setItem('masterKeyPair', JSON.stringify(result))
        }))

        const genericSigningKey = deriveGenericSigningKeyPair(masterKeyPair)
        console.log(genericSigningKey, 'generic')
        dispatch(actions.encryptDataWithPasswordOnRegister(genericSigningKey)
        .then((result) => {
          console.log('inside generic')
          StorageManager.setItem('genericSigningKey', JSON.stringify(result))
        }))
        // dispatch(router.pushRoute('/wallet'))
      }
    }
  },

  setEntropyStatus: {
    expectedParams: ['sufficientEntropy', 'progress']
  },
  setPassphrase: {
    expectedParams: ['phrase']
  },
  setPassphraseWrittenDown: {
    expectedParams: ['value']
  },
  setUsername: {
    expectedParams: ['value']
  },
  setValueOwnURL: {
    expectedParams: ['value']
  },
  toggleHasOwnURL: {
    expectedParams: ['value']
  },
  checkCredentials: {
    expectedParams: [],
    async: true,
    creator: params => {
      return (dispatch, getState) => {
        const state = getState().get('registration').toJS()
        dispatch(actions.checkCredentials.buildAction(params, (backend) => {
          return backend.gateway
            .checkUserDoesNotExist({userName: state.username.value})
            .then(params => {
              if (state.ownURL.valueOwnURL.length > 1) {
                dispatch(actions.checkOwnUrl())
              } else {
                dispatch(actions.goForward())
              }
            })
        }))
      }
    }
  },
  checkOwnUrl: {
    expectedParams: [],
    async: true,
    creator: (data) => {
      return (dispatch, getState, {backend, services}) => {
        const pass = getState().toJS().registration.encryption.pass
        dispatch(actions.encryptDataWithPasswordOnRegister.buildAction(data, () => { // eslint-disable-line max-len
          return backend.encryption.encryptInformation({
            password: pass,
            data: data
          })
        }))
      }
    }
  },
  registerWallet: {
    expectedParams: [],
    async: true,
    creator: (params) => {
      return (dispatch, getState, {services, backend}) => {
        const state = getState().get('registration').toJS()
        dispatch(actions.registerWallet.buildAction(params, async () => {
          await services.auth.register({
            userName: state.username.value,
            seedPhrase: state.passphrase.phrase,
            inviteCode: state.inviteCode,
            gatewayUrl: state.ownURL.valueOwnURL
          })
          await services.auth.login({
            seedPhrase: state.passphrase.phrase,
            gatewayUrl: state.ownURL.valueOwnURL
          })
          dispatch(router.pushRoute('/wallet'))
        })
      )
      }
    }
  },
  setInviteCode: {
    expectedParams: ['value']
  }
})

const initialState = Immutable.fromJS({
  username: {
    value: '',
    checking: false,
    errorMsg: '',
    valid: false,
    alphaNum: false
  },
  ownURL: {
    hasOwnURL: false,
    errorMsg: '',
    valueOwnURL: ''
  },
  maskedImage: {
    uncovering: false
  },
  passphrase: {
    sufficientEntropy: false,
    progress: 0,
    phrase: '',
    writtenDown: false,
    valid: false
  },
  wallet: {
    registering: false,
    registered: false,
    errorMsg: null
  },
  inviteCode: null,
  complete: false
})

export default (state = initialState, action = {}) => {
  state = state.set('complete', helpers._isComplete(state))
  switch (action.type) {
    case actions.setEntropyStatus.id:
      return state.mergeDeep({
        passphrase: {
          sufficientEntropy: action.sufficientEntropy,
          progress: action.progress
        }
      })

    case actions.setPassphrase.id:
      return state.mergeIn(['passphrase'], {
        phrase: action.mnemonic
      })

    case actions.setMaskedImageUncovering.id:
      return state.setIn(['maskedImage', 'uncovering'], action.value)

    case actions.setPassphraseWrittenDown.id:
      state = state.mergeDeep({
        passphrase: {
          writtenDown: action.value,
          valid: !!state.getIn(['passphrase', 'phrase']) && action.value
        }
      })

      return state.set('complete', helpers._isComplete(state))

    case actions.registerWallet.id:
      return state.mergeDeep({
        wallet: {
          registering: true,
          registered: false,
          errorMsg: null
        }
      })

    case actions.registerWallet.id_success:
      return state.mergeDeep({
        wallet: {
          registering: true,
          registered: true
        }
      })

    case actions.registerWallet.id_fail:
      return state.mergeDeep({
        wallet: {
          registering: false,
          registered: false,
          errorMsg: action.error.message
        }
      })

    case actions.setUsername.id:
      return state.mergeDeep({
        username: {
          value: action.value,
          alphaNum: (/^[a-z0-9]+$/i.test(action.value)),
          valid: action.value.trim() !== '',
          errorMsg: ''
        }
      })

    case actions.checkCredentials.id:
      return state.mergeDeep({
        username: {
          checking: true
        }
      })

    case actions.checkCredentials.id_success:
      return state.mergeDeep({
        username: {
          checking: false,
          errorMsg: ''
        }
      })

    case actions.checkCredentials.id_fail:
      return state.mergeDeep({
        username: {
          checking: false,
          errorMsg: action.error.message
        }
      })

    case actions.toggleHasOwnURL.id:
      return state.mergeIn(['ownURL'], {
        hasOwnURL: action.value
      })

    case actions.setValueOwnURL.id:
      return state.mergeIn(['ownURL'], {
        valueOwnURL: action.value
      })

    case actions.checkOwnUrl.id:
      return state.mergeIn(['ownURL'], {
        errorMsg: ''
      })

    case actions.checkOwnUrl.id_success:
      return state.mergeIn(['ownURL'], {
        errorMsg: ''
      })

    case actions.checkOwnUrl.id_fail:
      return state.mergeIn(['ownURL'], {
        errorMsg: action.error.message
      })

    default:
      return state
  }
}

export const helpers = {
  _isComplete: (state) => {
    const isFieldValid = (fieldName) => state.getIn([fieldName, 'valid'])
    const areFieldsValid = (fields) => every(fields, isFieldValid)

    return areFieldsValid(['passphrase'])
  },
  _getNextURLfromState: (state) => {
    const currentPath = state.get('routing').locationBeforeTransitions.pathname
    return NEXT_ROUTES[currentPath]
  }
}
