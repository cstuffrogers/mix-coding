import 'dart:convert';
import 'dart:typed_data';

import 'package:archive/archive.dart';
import 'package:excel/excel.dart';
import 'package:uuid/uuid.dart';

import '../models/department.dart';
import '../models/person.dart';
import 'database_service.dart';

class PersonImportResult {
  final int imported;
  final int skipped;

  const PersonImportResult({required this.imported, required this.skipped});
}

class PersonImportService {
  final DatabaseService _database;

  PersonImportService({DatabaseService? database})
    : _database = database ?? DatabaseService();

  /// excel 4.0.6 的解析器拒绝 numFmtId < 164 的自定义数字格式
  /// （常见于 WPS/部分工具生成的 xlsx），解包后移除 numFmts 段再重打包绕过。
  static Uint8List _sanitizeNumFmt(Uint8List bytes) {
    final Archive archive;
    try {
      archive = ZipDecoder().decodeBytes(bytes);
    } catch (_) {
      return bytes;
    }

    const stylesName = 'xl/styles.xml';
    final styles = archive.findFile(stylesName);
    if (styles == null) return bytes;

    final content = utf8.decode(styles.content as List<int>);
    final cleaned = content.replaceAllMapped(
      RegExp(r'<numFmts[^>]*>.*?</numFmts>', dotAll: true),
      (_) => '',
    );
    if (cleaned == content) return bytes;

    final updated = ArchiveFile.string(stylesName, cleaned);
    archive
      ..removeFile(styles)
      ..addFile(updated);
    return Uint8List.fromList(ZipEncoder().encode(archive)!);
  }

  Future<PersonImportResult> importXlsx(Uint8List bytes) async {
    final workbook = Excel.decodeBytes(_sanitizeNumFmt(bytes));
    if (workbook.tables.isEmpty) {
      throw const FormatException('Excel 文件没有工作表');
    }

    final sheet = workbook.tables.values.first;
    if (sheet.rows.isEmpty) {
      throw const FormatException('Excel 文件为空');
    }

    final departments = await _database.getDepartments();
    final departmentByName = {
      for (final department in departments) department.name: department,
    };
    var imported = 0;
    var skipped = 0;

    for (final row in sheet.rows.skip(1)) {
      final values = row
          .map((cell) => cell?.value?.toString().trim() ?? '')
          .toList();
      if (values.length < 2 || values[0].isEmpty || values[1].isEmpty) {
        skipped++;
        continue;
      }

      final department =
          departmentByName[values[1]] ??
          Department(id: const Uuid().v4(), name: values[1]);
      if (!departmentByName.containsKey(values[1])) {
        await _database.saveDepartment(department);
        departmentByName[department.name] = department;
      }

      await _database.savePerson(
        Person(
          id: const Uuid().v4(),
          name: values[0],
          departmentId: department.id,
          remark: values.length > 2 && values[2].isNotEmpty ? values[2] : null,
        ),
      );
      imported++;
    }

    return PersonImportResult(imported: imported, skipped: skipped);
  }
}
