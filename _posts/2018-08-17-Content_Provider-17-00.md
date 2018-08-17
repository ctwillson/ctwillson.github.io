---
layout: post
title: Android 应用开发<三> Content Provider
categories: "Android App"
description: "Android App"
keywords:
---

## Android Content Provider
Content Provider:内容提供器，用于在不同应用程序中共享数据，比如当我们的 app 需要访问通讯录的联系人，则需要通过内容提供器，当然在使用该功能前，需要注意到Android的运行时权限问题，Content Provider 底层实现由 binder 和 ashmem 完成，注意到 ContentResovler

### 使用现有内容提供器
内容提供器相关类 ContentResolver，获取方式 getContentResolver；运行时权限相关：checkSelfPermission 检查权限，ActivityCompat.requestPermissions 弹出权限申请界面，onRequestPermissionsResult 回调函数，用户在设置完权限后，回调该函数

```java
public class MainActivity extends AppCompatActivity {
    ArrayAdapter<String> adapter;

    List<String> contactsList = new ArrayList<>();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        ListView contactView = (ListView) findViewById(R.id.contacts_view);
        adapter = new ArrayAdapter<String>(this,android.R.layout.simple_list_item_1,contactsList);
        contactView.setAdapter(adapter);
        if(ContextCompat.checkSelfPermission(this, Manifest.permission.READ_CONTACTS)
                != PackageManager.PERMISSION_GRANTED){
            ActivityCompat.requestPermissions(this,new String[]{Manifest.permission.READ_CONTACTS},1);
        } else {
            readContacts();
        }
    }



    private void readContacts(){
        Cursor cursor = null;
        try{
            cursor = getContentResolver().query(ContactsContract.CommonDataKinds.Phone.CONTENT_URI,null,null,null,null);
            if (cursor != null) {
                while (cursor.moveToNext()) {
                    String displayName = cursor.getString(cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME));
                    String number = cursor.getString(cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.NUMBER));
                    contactsList.add(displayName + "\n" + number);
                }
                adapter.notifyDataSetChanged();
            }
            } catch (Exception e) {
                e.printStackTrace();
            } finally {
                if (cursor != null) {
                    cursor.close();
                }
            }
        }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        switch (requestCode) {
            case 1:
                if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED){
                    readContacts();
                } else {
                    Toast.makeText(this, "You denied the permission",Toast.LENGTH_SHORT).show();
                }
                break;
            default:
        }
    }
}
```

### 创建自己的内容提供器
继承类 ContentProvider，然后重写 onCreate 、query、insert、update、delete、getType 六种方法
