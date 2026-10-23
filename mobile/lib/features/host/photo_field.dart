import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/theme.dart';

const photoLimit = 6;
const photoMaxBytes = 10 * 1024 * 1024;
const _tile = 108.0;

class StagedPhoto {
  const StagedPhoto({required this.name, required this.bytes});

  final String name;
  final Uint8List bytes;
}

class UploadProgress {
  const UploadProgress(this.index, this.fraction);

  final int index;
  final double fraction;
}

/// Photo tiles for the create form: pick from the camera or library, remove, hold and drag to reorder.
/// The first tile is the cover. Uploads happen after the activity exists, shown here through [uploading].
class PhotoField extends StatefulWidget {
  const PhotoField({super.key, required this.photos, required this.onChanged, this.uploading, this.enabled = true});

  final List<StagedPhoto> photos;
  final ValueChanged<List<StagedPhoto>> onChanged;
  final UploadProgress? uploading;
  final bool enabled;

  @override
  State<PhotoField> createState() => _PhotoFieldState();
}

class _PhotoFieldState extends State<PhotoField> {
  final _picker = ImagePicker();
  String? _problem;

  Future<void> _add() async {
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          ListTile(leading: const Icon(Icons.photo_camera_outlined), title: const Text('Take a photo'), onTap: () => Navigator.pop(context, ImageSource.camera)),
          ListTile(leading: const Icon(Icons.photo_library_outlined), title: const Text('Choose from library'), onTap: () => Navigator.pop(context, ImageSource.gallery)),
          const SizedBox(height: 8),
        ]),
      ),
    );
    if (source == null) return;
    final room = photoLimit - widget.photos.length;
    List<XFile> picked;
    try {
      if (source == ImageSource.camera) {
        final shot = await _picker.pickImage(source: source, maxWidth: 2048, imageQuality: 85);
        picked = shot == null ? const [] : [shot];
      } else {
        picked = await _picker.pickMultiImage(maxWidth: 2048, imageQuality: 85, limit: room > 1 ? room : null);
      }
    } on PlatformException catch (e) {
      setState(() => _problem = e.code.contains('camera') ? 'No camera on this device. Pick from your library instead.' : 'Velio needs permission to use your photos.');
      return;
    }
    if (picked.isEmpty) return;

    final next = [...widget.photos];
    String? problem;
    for (final file in picked) {
      final name = file.name.toLowerCase();
      if (!(name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png') || name.endsWith('.webp'))) {
        problem = 'Photos need to be JPG, PNG or WebP.';
        continue;
      }
      final bytes = await file.readAsBytes();
      if (bytes.length > photoMaxBytes) {
        problem = "This one's over 10 MB. Try a smaller photo.";
        continue;
      }
      if (next.length >= photoLimit) {
        problem = "That's the limit of 6 photos.";
        break;
      }
      next.add(StagedPhoto(name: file.name, bytes: bytes));
    }
    if (!mounted) return;
    setState(() => _problem = problem);
    widget.onChanged(next);
  }

  void _reorder(int from, int to) {
    if (from == to) return;
    final next = [...widget.photos];
    final moved = next.removeAt(from);
    next.insert(to, moved);
    HapticFeedback.selectionClick();
    widget.onChanged(next);
  }

  @override
  Widget build(BuildContext context) {
    final photos = widget.photos;
    final uploading = widget.uploading;
    final canAdd = widget.enabled && uploading == null && photos.length < photoLimit;
    return Wrap(
      spacing: 10,
      runSpacing: 10,
      children: [
        for (var i = 0; i < photos.length; i++)
          if (uploading != null && uploading.index == i)
            _UploadingTile(fraction: uploading.fraction)
          else
            _DraggableTile(
              index: i,
              enabled: widget.enabled && uploading == null,
              onReorder: _reorder,
              child: _PhotoTile(
                photo: photos[i],
                isCover: i == 0,
                dimmed: uploading != null && i > uploading.index,
                onRemove: widget.enabled && uploading == null ? () => widget.onChanged([...photos]..removeAt(i)) : null,
              ),
            ),
        if (_problem != null) _ProblemTile(message: _problem!),
        if (canAdd) _AddTile(onTap: _add),
      ],
    );
  }
}

class _DraggableTile extends StatelessWidget {
  const _DraggableTile({required this.index, required this.enabled, required this.onReorder, required this.child});

  final int index;
  final bool enabled;
  final void Function(int from, int to) onReorder;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (!enabled) return child;
    return DragTarget<int>(
      onWillAcceptWithDetails: (details) => details.data != index,
      onAcceptWithDetails: (details) => onReorder(details.data, index),
      builder: (context, candidates, _) => LongPressDraggable<int>(
        data: index,
        hapticFeedbackOnStart: true,
        feedback: Material(color: Colors.transparent, child: Opacity(opacity: 0.9, child: Transform.scale(scale: 1.06, child: child))),
        childWhenDragging: Opacity(opacity: 0.3, child: child),
        child: Container(
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(16), border: candidates.isNotEmpty ? Border.all(color: VelioColors.primary, width: 2) : null),
          child: child,
        ),
      ),
    );
  }
}

class _PhotoTile extends StatelessWidget {
  const _PhotoTile({required this.photo, required this.isCover, required this.dimmed, this.onRemove});

  final StagedPhoto photo;
  final bool isCover;
  final bool dimmed;
  final VoidCallback? onRemove;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: _tile,
      height: _tile,
      child: Opacity(
        opacity: dimmed ? 0.6 : 1,
        child: Stack(children: [
          ClipRRect(borderRadius: BorderRadius.circular(16), child: Image.memory(photo.bytes, width: _tile, height: _tile, fit: BoxFit.cover, gaplessPlayback: true)),
          if (isCover)
            Positioned(
              left: 10,
              bottom: 10,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(color: VelioColors.ink, borderRadius: BorderRadius.circular(VelioRadius.chip)),
                child: const Text('Cover', style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w700)),
              ),
            ),
          if (onRemove != null)
            Positioned(
              right: 6,
              top: 6,
              child: Semantics(
                button: true,
                label: isCover ? 'Remove cover photo' : 'Remove photo',
                child: InkWell(
                  onTap: onRemove,
                  customBorder: const CircleBorder(),
                  child: Container(
                    width: 36,
                    height: 36,
                    decoration: const BoxDecoration(color: VelioColors.surface, shape: BoxShape.circle, boxShadow: [BoxShadow(color: Color(0x2E15171A), blurRadius: 8, offset: Offset(0, 2))]),
                    child: const Icon(Icons.close, size: 18, color: VelioColors.ink),
                  ),
                ),
              ),
            ),
        ]),
      ),
    );
  }
}

class _UploadingTile extends StatelessWidget {
  const _UploadingTile({required this.fraction});

  final double fraction;

  @override
  Widget build(BuildContext context) {
    final pct = (fraction * 100).round();
    return Semantics(
      liveRegion: true,
      label: 'Uploading photo, $pct percent',
      child: Container(
        width: _tile,
        height: _tile,
        decoration: BoxDecoration(color: VelioColors.border, borderRadius: BorderRadius.circular(16)),
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          const Text('Uploading', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: VelioColors.ink)),
          const SizedBox(height: 4),
          Text('$pct%', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: VelioColors.body)),
          const SizedBox(height: 10),
          SizedBox(
            width: 64,
            child: ClipRRect(borderRadius: BorderRadius.circular(4), child: LinearProgressIndicator(value: fraction, minHeight: 5, backgroundColor: VelioColors.surface, color: VelioColors.primary)),
          ),
        ]),
      ),
    );
  }
}

class _ProblemTile extends StatelessWidget {
  const _ProblemTile({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      liveRegion: true,
      child: Container(
        width: _tile,
        height: _tile,
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(color: VelioColors.warningBackground, borderRadius: BorderRadius.circular(16), border: Border.all(color: VelioColors.scarcityDot, width: 1.5)),
        child: Center(child: Text(message, textAlign: TextAlign.center, style: const TextStyle(fontSize: 12, height: 1.3, fontWeight: FontWeight.w600, color: VelioColors.warningText))),
      ),
    );
  }
}

class _AddTile extends StatelessWidget {
  const _AddTile({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'Add photo',
      excludeSemantics: true,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: CustomPaint(
          painter: _DashedBorderPainter(),
          child: const SizedBox(
            width: _tile,
            height: _tile,
            child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              Icon(Icons.photo_camera_outlined, size: 26, color: VelioColors.primary),
              SizedBox(height: 6),
              Text('Add photo', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: VelioColors.primary)),
            ]),
          ),
        ),
      ),
    );
  }
}

class _DashedBorderPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final rect = RRect.fromRectAndRadius(Offset.zero & size, const Radius.circular(16)).deflate(0.75);
    final paint = Paint()
      ..color = VelioColors.inputBorder
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;
    final path = Path()..addRRect(rect);
    const dash = 5.0;
    const gap = 4.0;
    for (final metric in path.computeMetrics()) {
      var distance = 0.0;
      while (distance < metric.length) {
        canvas.drawPath(metric.extractPath(distance, distance + dash), paint);
        distance += dash + gap;
      }
    }
  }

  @override
  bool shouldRepaint(_DashedBorderPainter oldDelegate) => false;
}
