---
name: Expo Web date fields
description: Cross-platform date picker behavior for the Expo Mobile artifact.
---

`@react-native-community/datetimepicker` is appropriate for iOS and Android but does not provide the browser picker used by Expo Web. Shared date fields need a Platform.OS === "web" branch backed by an HTML `input type="date"`; native platforms should keep the community picker.

**Why:** The Replit mobile preview is often opened in an Android browser, where the native picker component can render no usable control even though the press state changes.

**How to apply:** Keep date parsing and formatting in the shared field, enforce min/max constraints on both paths, and avoid rendering `DateTimePicker` at all on web.