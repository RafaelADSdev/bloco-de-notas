package com.rafaeladsdev.linhaclara;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.IOException;
import java.io.OutputStream;

@CapacitorPlugin(name = "SaveDocument")
public class SaveDocumentPlugin extends Plugin {
    @PluginMethod
    public void save(PluginCall call) {
        String name = call.getString("name");
        String type = call.getString("type");
        if (name == null || type == null || call.getString("data") == null) {
            call.reject("Arquivo inválido.");
            return;
        }

        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(type);
        intent.putExtra(Intent.EXTRA_TITLE, name);
        startActivityForResult(call, intent, "onDocumentChosen");
    }

    @ActivityCallback
    private void onDocumentChosen(PluginCall call, ActivityResult result) {
        if (call == null) return;

        Intent data = result.getData();
        Uri target = data == null ? null : data.getData();
        JSObject response = new JSObject();
        if (result.getResultCode() != Activity.RESULT_OK || target == null) {
            call.resolve(response.put("saved", false));
            return;
        }

        bridge.execute(() -> {
            try (OutputStream output = getContext().getContentResolver().openOutputStream(target, "w")) {
                if (output == null) throw new IOException("Destino indisponível.");
                output.write(Base64.decode(call.getString("data"), Base64.DEFAULT));
            } catch (IOException | IllegalArgumentException | SecurityException error) {
                call.reject("Não foi possível gravar o arquivo.", error);
                return;
            }
            call.resolve(response.put("saved", true));
        });
    }
}
