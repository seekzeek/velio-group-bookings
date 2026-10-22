# Velio mobile

Flutter app for invited guests, bookers and hosts. See the root README for the quick start and API.md for the contract.

```
flutter create . --platforms=android,ios --project-name velio   # once, generates the platform folders
flutter pub get
flutter run                                                        # Android emulator reaches the backend at 10.0.2.2:4000
flutter run --dart-define=API_BASE_URL=http://<your-ip>:4000       # a real phone on the same network
```
