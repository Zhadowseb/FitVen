Pod::Spec.new do |s|
  s.name           = 'LiveWorkout'
  s.version        = '1.0.0'
  s.summary        = 'The running strength workout on the lock screen.'
  s.description    = 'Starts, updates and ends the Live Activity for a running strength workout, and hands the taps its buttons queued to JavaScript.'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # The app runs on iOS 15.1; ActivityKit is 16.1 and AppIntents 16.0. Weak
  # links keep the app launching on iOS 15, for this pod and for the
  # targets/widgets/_shared files compiled into the app, whose use of both is
  # behind availability checks.
  s.weak_frameworks = ['ActivityKit', 'AppIntents']

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift}"
end
