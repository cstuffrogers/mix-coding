import 'dart:typed_data';

import 'package:excel/excel.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';

import '../models/tracked_file.dart';
import '../models/person.dart';
import 'database_service.dart';

/// 导出/导入交办记录到 Excel。
/// 导出格式可直接用于导入，确保 round-trip 一致性。
class HandoffExportService {
  static const _sheetName = '交办记录';

  /// 导出并保存文件
  static Future<void> download({
    required List<TrackedFile> files,
    required String Function(String id) personLabel,
    required BuildContext context,
  }) async {
    if (files.isEmpty) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('暂无文件可导出')));
      return;
    }

    final workbook = Excel.createExcel();
    // createExcel 自带空 Sheet1，删除它避免导出文件含空表、干扰导入
    final defaultSheet = workbook.getDefaultSheet();
    if (defaultSheet != null) {
      workbook.delete(defaultSheet);
    }
    final sheet = workbook[_sheetName];

    sheet.appendRow([
      TextCellValue('编号'),
      TextCellValue('文件名'),
      TextCellValue('登记时间'),
      TextCellValue('备注'),
      TextCellValue('交办人'),
      TextCellValue('办理人'),
      TextCellValue('交办时间'),
      TextCellValue('办结时间'),
      TextCellValue('备注-交办'),
    ]);

    for (final file in files) {
      final handoffs = file.handoffs;
      if (handoffs.isEmpty) {
        sheet.appendRow(_exportRow(file, null, personLabel));
        continue;
      }
      for (final h in handoffs) {
        sheet.appendRow(_exportRow(file, h, personLabel));
      }
    }

    final doc = workbook.encode();
    if (doc == null) return;
    final bytes = Uint8List.fromList(doc);

    await FilePicker.platform.saveFile(
      dialogTitle: '导出交办记录',
      fileName: '交办记录.xlsx',
      type: FileType.custom,
      allowedExtensions: ['xlsx'],
      bytes: bytes,
    );
  }

  static List<CellValue?> _exportRow(
    TrackedFile file,
    Handoff? h,
    String Function(String id) personLabel,
  ) {
    return [
      TextCellValue(file.number),
      TextCellValue(file.name),
      TextCellValue(_formatDate(file.registeredAt)),
      TextCellValue(file.remark ?? ''),
      TextCellValue(h == null ? '' : personLabel(h.fromPersonId)),
      TextCellValue(h == null ? '' : personLabel(h.toPersonId)),
      TextCellValue(h == null ? '' : _formatDate(h.assignedAt)),
      TextCellValue(
        h == null
            ? ''
            : (h.completedAt == null ? '' : _formatDate(h.completedAt!)),
      ),
      TextCellValue(h == null ? '' : (h.remark ?? '')),
    ];
  }

  /// 导入 Excel 字节，返回导入/跳过数量。
  /// 优先读「交办记录」表，否则取第一个非空表。
  static Future<ImportResult> import({
    required Uint8List bytes,
    required List<TrackedFile> currentFiles,
    required List<Person> persons,
  }) async {
    final workbook = Excel.decodeBytes(bytes);
    final sheet = _pickSheet(workbook);
    if (sheet == null || sheet.rows.isEmpty) {
      return const ImportResult(imported: 0, skipped: 0);
    }
    return _processImport(sheet, currentFiles, persons);
  }

  static Sheet? _pickSheet(Excel workbook) {
    final named = workbook.tables[_sheetName];
    if (named != null && named.rows.isNotEmpty) return named;
    for (final s in workbook.tables.values) {
      if (s.rows.isNotEmpty) return s;
    }
    return null;
  }

  static Future<ImportResult> _processImport(
    Sheet sheet,
    List<TrackedFile> currentFiles,
    List<Person> persons,
  ) async {
    var imported = 0;
    var skipped = 0;

    // 导出时写的是人员姓名，这里把姓名映射回 ID
    final personIdByName = {for (final p in persons) p.name: p.id};
    final existingNumbers = {for (final f in currentFiles) f.number};

    final headers = _rowValues(sheet.rows.first);

    for (var i = 1; i < sheet.rows.length; i++) {
      final file = _parseRow(sheet.rows[i], headers, personIdByName);
      if (file == null) {
        skipped++;
        continue;
      }
      if (existingNumbers.contains(file.number)) {
        skipped++;
        continue;
      }
      await DatabaseService().saveFile(file);
      imported++;
    }

    return ImportResult(imported: imported, skipped: skipped);
  }

  static List<String> _rowValues(List<dynamic> row) {
    return [
      for (final cell in row)
        (cell as Data?)?.value?.toString().trim() ?? '',
    ];
  }

  static TrackedFile? _parseRow(
    List<dynamic> row,
    List<String> headers,
    Map<String, String> personIdByName,
  ) {
    String? number, name, remark;
    DateTime? registeredAt;
    String? fromPersonName, toPersonName;
    DateTime? assignedAt, completedAt;
    String? handoffRemark;

    final values = _rowValues(row);
    for (var j = 0; j < headers.length && j < values.length; j++) {
      final cell = values[j];
      switch (headers[j]) {
        case '编号':
          number = cell.isEmpty ? null : cell;
        case '文件名':
          name = cell.isEmpty ? null : cell;
        case '登记时间':
          registeredAt = _parseDate(cell);
        case '备注':
          remark = cell.isEmpty ? null : cell;
        case '交办人':
          fromPersonName = cell.isEmpty ? null : cell;
        case '办理人':
          toPersonName = cell.isEmpty ? null : cell;
        case '交办时间':
          assignedAt = _parseDate(cell);
        case '办结时间':
          completedAt = _parseDate(cell);
        case '备注-交办':
          handoffRemark = cell.isEmpty ? null : cell;
      }
    }

    if (number == null || name == null) return null;

    final handoffs = <Handoff>[];
    if (toPersonName != null) {
      final toPersonId = personIdByName[toPersonName];
      // 找不到对应人员则放弃该条交办记录，只保留文件本身
      if (toPersonId != null) {
        handoffs.add(
          Handoff(
            id: DateTime.now().toIso8601String(),
            fromPersonId: fromPersonName == null
                ? '文件管理员'
                : personIdByName[fromPersonName] ?? fromPersonName,
            toPersonId: toPersonId,
            assignedAt: assignedAt ?? DateTime.now(),
            completedAt: completedAt,
            remark: handoffRemark,
          ),
        );
      }
    }

    return TrackedFile(
      id: DateTime.now().toIso8601String(),
      number: number,
      name: name,
      registeredAt: registeredAt ?? DateTime.now(),
      remark: remark,
      handoffs: handoffs,
    );
  }

  static DateTime _parseDate(String s) {
    try {
      return DateTime.parse(s);
    } catch (_) {
      return DateTime.now();
    }
  }

  static String _formatDate(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')} '
      '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
}

class ImportResult {
  final int imported;
  final int skipped;

  const ImportResult({required this.imported, required this.skipped});
}