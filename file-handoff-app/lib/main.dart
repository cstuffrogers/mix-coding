import 'package:flutter/material.dart';

import 'pages/home_page.dart';

void main() {
  runApp(const FileHandoffApp());
}

class FileHandoffApp extends StatelessWidget {
  const FileHandoffApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '文件交接登记',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.blue.shade700),
        useMaterial3: true,
      ),
      home: const HomePage(),
    );
  }
}
