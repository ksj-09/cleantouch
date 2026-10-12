package kr.cleantouch.scan;

import android.app.Activity;
import android.os.Bundle;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.widget.ImageView;
import java.io.InputStream;

/** Independent fixture app: no Kotlin/app dependency needed in its separate process. */
public class VideoFixtureActivity extends Activity {
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        ImageView image = new ImageView(this);
        try (InputStream input = getAssets().open("bag.png")) {
            image.setImageBitmap(BitmapFactory.decodeStream(input));
        } catch (java.io.IOException error) { throw new IllegalStateException(error); }
        image.setScaleType(ImageView.ScaleType.FIT_CENTER);
        image.setBackgroundColor(Color.BLACK);
        setContentView(image);
    }
}
