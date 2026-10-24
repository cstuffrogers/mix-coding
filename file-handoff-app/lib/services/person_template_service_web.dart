// ignore_for_file: avoid_web_libraries_in_flutter, deprecated_member_use

import 'dart:html' as html;

import 'package:excel/excel.dart';

class PersonTemplateService {
  static void download() {
    final excel = Excel.createExcel();
    final sheet = excel.sheets[excel.getDefaultSheet()]!;
    sheet.appendRow([
      TextCellValue('姓名'),
      TextCellValue('部门'),
      TextCellValue('备注'),
    ]);
    sheet.appendRow([
      TextCellValue('张三'),
      TextCellValue('技术部'),
      TextCellValue('示例行，可删除'),
    ]);
    sheet.appendRow([
      TextCellValue('李四'),
      TextCellValue('行政部'),
      TextCellValue(''),
    ]);
    final bytes = excel.encode()!;
    final blob = html.Blob([
      bytes,
    ], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    final url = html.Url.createObjectUrlFromBlob(blob);
    html.AnchorElement(href: url)
      ..setAttribute('download', '人员导入模板.xlsx')
      ..click();
    html.Url.revokeObjectUrl(url);
  }
}
