package io.github.simon123h.jotter;

import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;
import android.view.Window;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "StoragePermission")
public class StoragePermissionPlugin extends Plugin {

    @PluginMethod
    public void checkPermission(PluginCall call) {
        JSObject ret = new JSObject();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            ret.put("granted", Environment.isExternalStorageManager());
        } else {
            ret.put("granted", true);
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        JSObject ret = new JSObject();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            boolean isManager = Environment.isExternalStorageManager();
            if (!isManager) {
                try {
                    Intent intent = new Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION);
                    intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                    getActivity().startActivity(intent);
                } catch (Exception e) {
                    try {
                        Intent intent = new Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION);
                        getActivity().startActivity(intent);
                    } catch (Exception ignored) {
                    }
                }
            }
            ret.put("granted", isManager);
        } else {
            ret.put("granted", true);
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void setStatusBarColor(PluginCall call) {
        String colorHex = call.getString("color");
        Boolean isDarkIcons = call.getBoolean("darkIcons", false);
        if (colorHex == null) {
            call.reject("Color is required");
            return;
        }

        getActivity().runOnUiThread(() -> {
            try {
                Window window = getActivity().getWindow();
                int color = Color.parseColor(colorHex);
                window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
                window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
                window.setStatusBarColor(color);

                WindowInsetsControllerCompat insetsController = WindowCompat.getInsetsController(window, window.getDecorView());
                if (insetsController != null) {
                    insetsController.setAppearanceLightStatusBars(Boolean.TRUE.equals(isDarkIcons));
                }
                call.resolve();
            } catch (Exception e) {
                call.reject("Failed to set status bar color: " + e.getMessage());
            }
        });
    }
}
