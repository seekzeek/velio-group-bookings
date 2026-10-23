import 'package:flutter/material.dart';

import '../core/theme.dart';

class PickerOption<T> {
  const PickerOption(this.value, this.label, {this.detail});

  final T value;
  final String label;
  final String? detail;
}

/// A select drawn like the canvas's inputs: 52px, 12px radius, 1.5px border, chevron. Tapping opens a sheet of the
/// options with a tick on the current one, instead of the Material dropdown menu.
class PickerField<T> extends StatelessWidget {
  const PickerField(
      {super.key,
      required this.value,
      required this.options,
      required this.onChanged,
      required this.sheetTitle,
      this.semanticsLabel,
      this.searchHint,
      this.emptyTitle = 'Nothing matches',
      this.emptyBody});

  final T value;
  final List<PickerOption<T>> options;
  final ValueChanged<T> onChanged;
  final String sheetTitle;
  final String? semanticsLabel;

  /// A search box at the top of the sheet when set. Long lists need it; a handful of currencies does not.
  final String? searchHint;
  final String emptyTitle;
  final String? emptyBody;

  @override
  Widget build(BuildContext context) {
    final current = options.where((o) => o.value == value).firstOrNull;
    return Semantics(
      button: true,
      label: semanticsLabel ?? sheetTitle,
      value: current?.label,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () async {
          final searchable = searchHint != null;
          final picked = await showModalBottomSheet<T>(
            context: context,
            showDragHandle: true,
            isScrollControlled: searchable,
            backgroundColor: VelioColors.ground,
            builder: (context) => Padding(
              padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
              child: SizedBox(
                height: searchable ? MediaQuery.sizeOf(context).height * 0.72 : null,
                child: SafeArea(child: _OptionsSheet<T>(title: sheetTitle, options: options, value: value, searchHint: searchHint, emptyTitle: emptyTitle, emptyBody: emptyBody)),
              ),
            ),
          );
          if (picked != null) onChanged(picked);
        },
        child: Container(
          height: 52,
          padding: const EdgeInsets.fromLTRB(14, 0, 10, 0),
          decoration: BoxDecoration(color: VelioColors.surface, borderRadius: BorderRadius.circular(12), border: Border.all(color: VelioColors.inputBorder, width: 1.5)),
          child: Row(children: [
            Expanded(child: Text(current?.label ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 15, color: VelioColors.ink))),
            const Icon(Icons.expand_more_rounded, size: 22, color: VelioColors.muted),
          ]),
        ),
      ),
    );
  }
}

/// The same skin for a field that opens a dialog, such as the date or the time, with a leading icon.
class FieldButton extends StatelessWidget {
  const FieldButton({super.key, required this.label, required this.onTap, this.icon, this.placeholder = false, this.semanticsLabel});

  final String label;
  final VoidCallback onTap;
  final IconData? icon;
  final bool placeholder;
  final String? semanticsLabel;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: semanticsLabel ?? label,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Container(
          height: 52,
          padding: const EdgeInsets.symmetric(horizontal: 14),
          decoration: BoxDecoration(color: VelioColors.surface, borderRadius: BorderRadius.circular(12), border: Border.all(color: VelioColors.inputBorder, width: 1.5)),
          child: Row(children: [
            if (icon != null) ...[Icon(icon, size: 18, color: VelioColors.muted), const SizedBox(width: 10)],
            Expanded(child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 15, color: placeholder ? VelioColors.muted : VelioColors.ink))),
          ]),
        ),
      ),
    );
  }
}

class _OptionsSheet<T> extends StatefulWidget {
  const _OptionsSheet({required this.title, required this.options, required this.value, this.searchHint, required this.emptyTitle, this.emptyBody});

  final String title;
  final List<PickerOption<T>> options;
  final T value;
  final String? searchHint;
  final String emptyTitle;
  final String? emptyBody;

  @override
  State<_OptionsSheet<T>> createState() => _OptionsSheetState<T>();
}

class _OptionsSheetState<T> extends State<_OptionsSheet<T>> {
  String _query = '';

  List<PickerOption<T>> get _shown {
    final q = _query.trim().toLowerCase();
    if (q.isEmpty) return widget.options;
    return widget.options.where((o) => o.label.toLowerCase().contains(q) || (o.detail?.toLowerCase().contains(q) ?? false)).toList();
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final options = _shown;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(padding: const EdgeInsets.fromLTRB(20, 0, 20, 8), child: Text(widget.title, style: text.titleLarge)),
        if (widget.searchHint != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 8),
            child: TextField(
              autofocus: true,
              onChanged: (v) => setState(() => _query = v),
              textInputAction: TextInputAction.search,
              decoration: InputDecoration(
                hintText: widget.searchHint,
                prefixIcon: const Icon(Icons.search_rounded, color: VelioColors.muted),
                suffixIcon: _query.isEmpty ? null : IconButton(icon: const Icon(Icons.close_rounded, color: VelioColors.muted), tooltip: 'Clear', onPressed: () => setState(() => _query = '')),
              ),
            ),
          ),
        if (options.isEmpty)
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(widget.emptyTitle, style: text.titleMedium),
              if (widget.emptyBody != null) ...[const SizedBox(height: 4), Text(widget.emptyBody!, style: text.bodySmall)],
            ]),
          ),
        Flexible(
          child: ListView.builder(
            shrinkWrap: true,
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
            itemCount: options.length,
            itemBuilder: (context, i) {
              final o = options[i];
              final value = widget.value;
              final selected = o.value == value;
              return ListTile(
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                selected: selected,
                selectedTileColor: VelioColors.primaryTint,
                title: Text(o.label, style: TextStyle(fontSize: 16, fontWeight: selected ? FontWeight.w700 : FontWeight.w500, color: selected ? VelioColors.primaryDeep : VelioColors.ink)),
                subtitle: o.detail == null ? null : Text(o.detail!, style: text.bodySmall),
                trailing: selected ? const Icon(Icons.check_rounded, color: VelioColors.primary) : null,
                onTap: () => Navigator.pop(context, o.value),
              );
            },
          ),
        ),
      ],
    );
  }
}
