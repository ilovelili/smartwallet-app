import React, { useState } from 'react'
import QRScanner from 'react-native-qrcode-scanner'
import { RNCamera } from 'react-native-camera'
import {
  Dimensions,
  StyleSheet,
  Text,
  TouchableHighlight,
  View,
  Animated,
} from 'react-native'
import I18n from '../../../locales/i18n'
import strings from '../../../locales/strings'
import { TorchOffIcon, TorchOnIcon } from '../../../resources'
import { black065, white } from '../../../styles/colors'
import { Colors, Spacing } from '../../../styles'
import {
  centeredText,
  fontLight,
  textSubheader,
  textSubheaderLineHeight,
} from '../../../styles/typography'
import { BP } from '../../../styles/breakpoints'
import { ErrorCode } from '../../../lib/errors'

const SCREEN_HEIGHT = Dimensions.get('window').height
const SCREEN_WIDTH = Dimensions.get('window').width
const MARKER_SIZE = SCREEN_WIDTH * 0.75

const styles = StyleSheet.create({
  rectangle: {
    height: MARKER_SIZE,
    width: MARKER_SIZE,
    borderRadius: 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  topOverlay: {
    backgroundColor: Colors.black065,
    width: '100%',
    height: BP({
      small: 165,
      medium: 175,
      large: 185,
    }),
  },
  bottomOverlay: {
    flex: 1,
    backgroundColor: Colors.black065,
    height: '100%',
    width: '100%',
    alignItems: 'center',
    zIndex: 1,
    justifyContent: 'space-between',
  },
  horizontalOverlay: {
    height: MARKER_SIZE,
    width: SCREEN_WIDTH,
    backgroundColor: black065,
  },
  descriptionText: {
    marginTop: Spacing.MD,
    color: Colors.white,
    fontSize: textSubheader,
    width: MARKER_SIZE,
    fontFamily: fontLight,
    lineHeight: textSubheaderLineHeight,
    ...centeredText,
  },
  torchWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  torch: {
    width: 69,
    height: 69,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: BP({
      large: 60,
      medium: 40,
      small: 20,
    }),
  },
})

interface Props {
  onScan: (jwt: string) => Promise<void>
  reRenderKey: number
}

export const ScannerComponent = (props: Props) => {
  const { onScan, reRenderKey } = props

  const [isError, setError] = useState()
  const [errorText, setErrorText] = useState()
  const [isTorchPressed, setTorchPressed] = useState(false)
  const [colorAnimationValue] = useState(new Animated.Value(0))
  const [textAnimationValue] = useState(new Animated.Value(0))

  const animateColor = () =>
    Animated.sequence([
      Animated.timing(colorAnimationValue, {
        toValue: 1,
        duration: 300,
      }),
      Animated.timing(colorAnimationValue, {
        toValue: 0,
        delay: 400,
        duration: 300,
      }),
    ])

  const animateText = () =>
    Animated.sequence([
      Animated.timing(textAnimationValue, {
        toValue: 1,
        duration: 200,
      }),
      Animated.timing(textAnimationValue, {
        toValue: 0,
        delay: 1200,
        duration: 500,
      }),
    ])

  const backgroundColorConfig = colorAnimationValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['transparent', 'rgba(243, 198, 28, 0.4)'],
  })

  const onRead = (event: { data: string }) => {
    return onScan(event.data).catch(err => {
      // TODO: use different message based on error code
      //       after fixing up error codes
      setError(true)
      if (err.code === ErrorCode.ParseJWTFailed) {
        setErrorText(strings.IS_THIS_THE_RIGHT_QR_CODE_TRY_AGAIN)
      } else {
        setErrorText(strings.LOOKS_LIKE_WE_CANT_PROVIDE_THIS_SERVICE)
      }
      Animated.parallel([animateColor(), animateText()]).start(() => {
        setError(false)
      })
    })
  }

  const cameraSettings = {
    key: reRenderKey,
    captureAudio: false,
    flashMode: isTorchPressed
      ? RNCamera.Constants.FlashMode.torch
      : RNCamera.Constants.FlashMode.off,
  }

  return (
    <React.Fragment>
      <QRScanner
        //@ts-ignore - see https://github.com/DefinitelyTyped/DefinitelyTyped/issues/29651
        containerStyle={{
          position: 'absolute',
        }}
        cameraProps={cameraSettings}
        reactivate={true}
        reactivateTimeout={3000}
        fadeIn
        onRead={onRead}
        cameraStyle={StyleSheet.create({
          //@ts-ignore
          height: SCREEN_HEIGHT,
        })}
      />
      <View style={styles.topOverlay} />
      <View
        style={{
          flexDirection: 'row',
        }}
      >
        <View style={styles.horizontalOverlay} />
        <Animated.View
          style={[
            styles.rectangle,
            {
              backgroundColor: backgroundColorConfig,
              borderColor: isError ? 'rgb(243, 198, 28)' : white,
            },
          ]}
        />
        <View style={styles.horizontalOverlay} />
      </View>
      <View style={styles.bottomOverlay}>
        {isError ? (
          <Animated.Text
            style={[
              {
                ...styles.descriptionText,
                color: 'rgb(243, 198, 28)',
              },
              {
                opacity: textAnimationValue,
              },
            ]}
          >
            {I18n.t(errorText)}
          </Animated.Text>
        ) : (
          <Text style={styles.descriptionText}>
            {I18n.t(
              strings.ITS_ALL_AUTOMATIC_JUST_PLACE_YOUR_PHONE_ABOVE_THE_CODE,
            )}
          </Text>
        )}
        <TouchableHighlight
          onPressIn={() => setTorchPressed(true)}
          onPressOut={() => setTorchPressed(false)}
          activeOpacity={1}
          underlayColor={'transparent'}
          style={styles.torch}
        >
          {isTorchPressed ? <TorchOnIcon /> : <TorchOffIcon />}
        </TouchableHighlight>
      </View>
    </React.Fragment>
  )
}
